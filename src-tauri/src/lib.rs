// Anvil · Tauri application entry
// VS-001 rule: the desktop shell must launch without requiring any model/sidecar.

pub mod dsh;
pub mod tray;
pub mod shortcuts;
pub mod system_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        // DSH commands remain available as an optional integration, but DSH is not
        // started during application boot. Optional tools may never block VS-001.
        .invoke_handler(tauri::generate_handler![
            dsh::commands::dsh_start,
            dsh::commands::dsh_stop,
            dsh::commands::dsh_status,
            dsh::commands::dsh_set_target,
            system_commands::toggle_window,
            system_commands::quit_app,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            let handle = app.handle();

            // Product shell only. No model, DSH bridge, localhost service, or
            // experimental runtime is allowed to become a hidden boot prerequisite.
            tray::create_tray(handle)?;
            shortcuts::setup_shortcuts(handle)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Anvil");
}
