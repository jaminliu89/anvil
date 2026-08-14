//! DSH 错误类型

use thiserror::Error;

#[derive(Error, Debug)]
pub enum DshError {
    #[error("DSH 进程启动失败: {0}")]
    StartFailed(String),

    #[error("DSH 进程崩溃，退出码: {0}")]
    Crash(i32),

    #[error("DSH 健康检查超时")]
    HealthCheckTimeout,

    #[error("端口分配失败")]
    PortAllocationFailed,

    #[error("DSH 未安装")]
    NotInstalled,

    #[error("未知错误: {0}")]
    Other(String),
}
