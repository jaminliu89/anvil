// 鲸团 · Tauri 应用库入口
// 注册插件、commands、系统托盘、全局快捷键

use tauri::Manager;

pub mod dsh;
pub mod tray;
pub mod shortcuts;
pub mod system_commands;

/// 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ====== 插件 ======
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
        // ====== 自定义 commands ======
        .invoke_handler(tauri::generate_handler![
            dsh::commands::dsh_start,
            dsh::commands::dsh_stop,
            dsh::commands::dsh_status,
            dsh::commands::dsh_port,
            system_commands::toggle_window,
            system_commands::quit_app,
        ])
        // ====== 窗口事件：关闭 → 最小化到托盘 ======
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 不退出，隐藏到托盘
                api.prevent_close();
                let _ = window.hide();
            }
        })
        // ====== 启动 ======
        .setup(|app| {
            let handle = app.handle();

            // 初始化 DSH 管理器
            dsh::manager::init(handle)?;

            // 系统托盘
            tray::setup_tray(handle)?;

            // 全局快捷键
            shortcuts::setup_shortcuts(handle)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running jingtuan application");
}
