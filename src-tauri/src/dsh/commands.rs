//! Sidecar 命令：前端可调用的 Tauri commands

use crate::dsh::manager::{SIDECAR_MANAGER, SidecarStatus};
use serde::Serialize;

#[derive(Serialize)]
pub struct SidecarState {
    pub status: String,
    pub port: Option<u16>,
    pub target: String,
    pub message: Option<String>,
}

#[tauri::command]
pub fn dsh_status() -> SidecarState {
    let target = SIDECAR_MANAGER.get_target();
    match SIDECAR_MANAGER.get_status() {
        SidecarStatus::Idle => SidecarState { status: "idle".into(), port: None, target, message: None },
        SidecarStatus::Starting => SidecarState { status: "starting".into(), port: None, target, message: None },
        SidecarStatus::Running { port } => SidecarState { status: "running".into(), port: Some(port), target, message: None },
        SidecarStatus::Stopping => SidecarState { status: "stopping".into(), port: None, target, message: None },
        SidecarStatus::Error { message } => SidecarState { status: "error".into(), port: None, target, message: Some(message) },
    }
}

/// 启动守卫服务（异步）
#[tauri::command]
pub async fn dsh_start() -> Result<u16, String> {
    SIDECAR_MANAGER.start().await
}

/// 停止守卫服务
#[tauri::command]
pub fn dsh_stop() -> Result<(), String> {
    SIDECAR_MANAGER.stop()
}

/// 切换推理目标（:18080 Ling / :8888 Unsloth）
#[tauri::command]
pub async fn dsh_set_target(target: String) -> Result<(), String> {
    SIDECAR_MANAGER.set_target(target).await
}
