//! 系统级 commands（窗口控制、退出等）

use crate::dsh;

/// 切换主窗口显示/隐藏
#[tauri::command]
pub fn toggle_window(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::Manager;
    match app.get_webview_window("main") {
        Some(window) => {
            match window.is_visible() {
                Ok(true) => {
                    let _ = window.hide();
                    Ok(false)
                }
                Ok(false) => {
                    let _ = window.show();
                    let _ = window.set_focus();
                    Ok(true)
                }
                Err(e) => Err(e.to_string()),
            }
        }
        None => Err("主窗口不存在".into()),
    }
}

/// 退出应用（关窗只是藏到托盘，真退出用这个）
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    // 先停 sidecar
    let _ = dsh::manager::SIDECAR_MANAGER.stop();
    app.exit(0);
}
