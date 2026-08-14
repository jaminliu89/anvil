//! DSH 进程管理器
//! 负责启动/停止/监控 DSH sidecar 进程

use std::process::Child;
use std::sync::Mutex;

use once_cell::sync::Lazy;

/// DSH 进程状态
#[derive(Debug, Clone, PartialEq)]
pub enum DshStatus {
    Idle,
    Starting,
    Running { port: u16 },
    Stopping,
    Error { message: String },
}

/// 全局 DSH 管理器
pub struct DshManager {
    status: Mutex<DshStatus>,
    child: Mutex<Option<Child>>,
}

impl DshManager {
    const fn new() -> Self {
        Self {
            status: Mutex::new(DshStatus::Idle),
            child: Mutex::new(None),
        }
    }

    pub fn get_status(&self) -> DshStatus {
        self.status.lock().unwrap().clone()
    }

    fn set_status(&self, status: DshStatus) {
        *self.status.lock().unwrap() = status;
    }
}

/// 全局单例
pub static DSH_MANAGER: Lazy<DshManager> = Lazy::new(DshManager::new);

/// 初始化 DSH 管理器
pub fn init<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // TODO:
    // 1. 检查 DSH 是否已安装在 resources 目录
    // 2. 如果没有，从内嵌 bundle 解压
    // 3. 设置环境变量（DSH_HOME 指向 app data 目录）
    // 4. 分配端口
    // 5. 启动 DSH 进程
    // 6. 健康检查

    Ok(())
}
