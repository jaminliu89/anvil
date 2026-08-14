//! 系统托盘

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

/// 创建系统托盘
pub fn setup_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // 菜单项
    let show_item = MenuItem::with_id(app, "show", "显示鲸团", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

    // 构建托盘图标
    let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("鲸团 · AI 助手团队")
        .menu(&menu)
        .show_menu_on_left_click(false) // 左键点击不弹出菜单，改为显示窗口
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                show_main_window(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                show_main_window(app);
            }
        })
        .build(app)?;

    Ok(())
}

/// 显示/聚焦主窗口
fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.unminimize();
    }
}

/// 发送桌面通知
pub fn notify<R: Runtime>(
    app: &tauri::AppHandle<R>,
    title: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // 通过 notification plugin 发送
    // 这里先留接口，前端也可以直接调 plugin
    println!("[通知] {}: {}", title, body);
    Ok(())
}
