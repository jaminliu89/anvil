//! 全局快捷键

use tauri::Runtime;

/// 注册全局快捷键
pub fn setup_shortcuts<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    let shortcut = Shortcut::try_from("Option+Space")?;

    app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, _event| {
        use tauri::Manager;
        // 切换主窗口显示/隐藏
        if let Some(window) = app.get_webview_window("main") {
            match window.is_visible() {
                Ok(true) => {
                    let _ = window.hide();
                }
                Ok(false) => {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.unminimize();
                }
                Err(_) => {}
            }
        }
    })?;

    Ok(())
}
