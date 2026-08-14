// 鲸团 · Tauri 应用库入口
// 注册插件、commands、系统托盘

use tauri::Manager;

pub mod dsh;

/// 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ====== 插件 ======
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 新实例启动时，聚焦已有窗口
            let _ = app.get_webview_window("main").map(|w| {
                let _ = w.show();
                let _ = w.set_focus();
            });
        }))
        // ====== 自定义 commands ======
        .invoke_handler(tauri::generate_handler![
            dsh::commands::dsh_start,
            dsh::commands::dsh_stop,
            dsh::commands::dsh_status,
            dsh::commands::dsh_port,
        ])
        // ====== 启动 ======
        .setup(|app| {
            // 初始化 DSH 管理器
            dsh::manager::init(app.handle())?;

            // 系统托盘菜单
            // TODO: 完善托盘菜单（快速唤起 / 查看任务 / 退出）

            // 全局快捷键
            // TODO: Option+Space 唤起窗口

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running jingtuan application");
}
