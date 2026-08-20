// Anvil · Tauri 应用库入口
// 注册插件、commands、系统托盘、全局快捷键

pub mod dsh;
pub mod pi;
pub mod codex;
pub mod tray;
pub mod shortcuts;
pub mod system_commands;
pub mod git_sandbox;

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
            dsh::commands::dsh_set_target,
            pi::commands::pi_start,
            pi::commands::pi_stop,
            pi::commands::pi_status,
            pi::commands::pi_send_prompt,
            pi::commands::pi_check_installed,
            codex::run_codex,
            codex::get_codex_quota,
            system_commands::toggle_window,
            system_commands::quit_app,
            git_sandbox::sandbox_create,
            git_sandbox::sandbox_discard,
            git_sandbox::sandbox_merge,
            git_sandbox::sandbox_diff,
            git_sandbox::sandbox_apply_and_commit,
            git_sandbox::sandbox_current_branch,
            git_sandbox::sandbox_list_branches,
        ])
        // ====== 窗口事件：关闭 → 最小化到托盘 ======
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        // ====== 启动 ======
        .setup(|app| {
            let handle = app.handle();

            // 初始化 sidecar 管理器（守卫服务）
            dsh::manager::init(handle)?;

            // 初始化 Pi 管理器（按需启动）
            pi::manager::init(handle)?;

            // 系统托盘
            tray::create_tray(handle)?;

            // 全局快捷键
            shortcuts::setup_shortcuts(handle)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Anvil");
}
