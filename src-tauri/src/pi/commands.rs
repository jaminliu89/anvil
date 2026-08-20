//! Pi Tauri Commands
//! 前端可调用的命令

use crate::pi::manager::{PiStatus, PI_MANAGER};
use serde::Serialize;

#[derive(Serialize)]
pub struct PiState {
    pub status: String,
    pub message: Option<String>,
}

#[tauri::command]
pub fn pi_status() -> PiState {
    match PI_MANAGER.get_status() {
        PiStatus::Idle => PiState { status: "idle".into(), message: None },
        PiStatus::Starting => PiState { status: "starting".into(), message: None },
        PiStatus::Running => PiState { status: "running".into(), message: None },
        PiStatus::Stopping => PiState { status: "stopping".into(), message: None },
        PiStatus::Error { message } => PiState { status: "error".into(), message: Some(message) },
    }
}

/// 启动 Pi RPC 进程
#[tauri::command]
pub async fn pi_start(app: tauri::AppHandle) -> Result<(), String> {
    PI_MANAGER.start(&app).await
}

/// 停止 Pi
#[tauri::command]
pub fn pi_stop() -> Result<(), String> {
    PI_MANAGER.stop()
}

/// 发送 prompt（异步触发，结果通过事件流返回）
#[tauri::command]
pub fn pi_send_prompt(message: String) -> Result<(), String> {
    PI_MANAGER.send_prompt(&message)
}

/// 检查 pi 是否已安装
#[tauri::command]
pub fn pi_check_installed() -> bool {
    std::path::Path::new("/Users/kimliu/.npm-global/bin/pi").exists()
        || std::path::Path::new("/usr/local/bin/pi").exists()
        || std::path::Path::new("/opt/homebrew/bin/pi").exists()
        || std::env::var("PATH")
            .map(|p| p.split(':').any(|d| std::path::Path::new(d).join("pi").exists()))
            .unwrap_or(false)
}
