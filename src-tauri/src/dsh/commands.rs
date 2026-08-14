//! DSH 命令：前端可调用的 Tauri commands

use crate::dsh::manager::{DshStatus, DSH_MANAGER};
use serde::Serialize;

#[derive(Serialize)]
pub struct DshState {
    pub status: String,
    pub port: Option<u16>,
    pub message: Option<String>,
}

/// 获取 DSH 状态
#[tauri::command]
pub fn dsh_status() -> DshState {
    match DSH_MANAGER.get_status() {
        DshStatus::Idle => DshState {
            status: "idle".into(),
            port: None,
            message: None,
        },
        DshStatus::Starting => DshState {
            status: "starting".into(),
            port: None,
            message: None,
        },
        DshStatus::Running { port } => DshState {
            status: "running".into(),
            port: Some(port),
            message: None,
        },
        DshStatus::Stopping => DshState {
            status: "stopping".into(),
            port: None,
            message: None,
        },
        DshStatus::Error { message } => DshState {
            status: "error".into(),
            port: None,
            message: Some(message),
        },
    }
}

/// 启动 DSH（异步）
#[tauri::command]
pub async fn dsh_start() -> Result<u16, String> {
    DSH_MANAGER.start().await
}

/// 停止 DSH
#[tauri::command]
pub fn dsh_stop() -> Result<(), String> {
    DSH_MANAGER.stop()
}

/// 获取 DSH 端口
#[tauri::command]
pub fn dsh_port() -> Option<u16> {
    DSH_MANAGER.get_port()
}
