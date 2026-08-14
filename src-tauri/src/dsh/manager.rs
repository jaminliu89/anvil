//! DSH 进程管理器
//! 负责启动/停止/监控 DSH sidecar 进程

use std::process::Child;
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use tauri::Emitter;
use tokio::time::sleep;

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
    port: Mutex<Option<u16>>,
}

impl DshManager {
    const fn new() -> Self {
        Self {
            status: Mutex::new(DshStatus::Idle),
            child: Mutex::new(None),
            port: Mutex::new(None),
        }
    }

    pub fn get_status(&self) -> DshStatus {
        self.status.lock().unwrap().clone()
    }

    pub fn get_port(&self) -> Option<u16> {
        *self.port.lock().unwrap()
    }

    fn set_status(&self, status: DshStatus) {
        *self.status.lock().unwrap() = status.clone();
        if let DshStatus::Running { port } = status {
            *self.port.lock().unwrap() = Some(port);
        }
    }

    /// 启动 DSH 进程
    pub async fn start(&self) -> Result<u16, String> {
        // 防止重复启动
        {
            let status = self.status.lock().unwrap();
            match *status {
                DshStatus::Running { .. } => {
                    return Ok(self.port.lock().unwrap().unwrap_or(0));
                }
                DshStatus::Starting => {
                    return Err("DSH 正在启动中".into());
                }
                _ => {}
            }
        }

        self.set_status(DshStatus::Starting);

        // 分配端口
        let port = match crate::dsh::port::find_available_port() {
            Ok(p) => p,
            Err(e) => {
                self.set_status(DshStatus::Error {
                    message: format!("端口分配失败: {}", e),
                });
                return Err(format!("端口分配失败: {}", e));
            }
        };

        // 获取 DSH home 目录（app data 目录）
        // MVP：先用临时目录，后续接入 Tauri path API
        let dsh_home = std::env::temp_dir()
            .join("jingtuan-dsh")
            .to_string_lossy()
            .to_string();

        // 启动 DSH web profile
        let child = std::process::Command::new("npx")
            .arg("@deepseek-ai/dsh")
            .arg("web")
            .arg("--port")
            .arg(port.to_string())
            .arg("--host")
            .arg("127.0.0.1")
            .env("DSH_HOME", &dsh_home)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                let msg = format!("启动 DSH 失败: {}", e);
                self.set_status(DshStatus::Error {
                    message: msg.clone(),
                });
                msg
            })?;

        // 保存进程句柄
        *self.child.lock().unwrap() = Some(child);

        // 健康检查：最多等 30 秒
        let max_retries = 60;
        let mut retries = 0;
        loop {
            if retries >= max_retries {
                self.set_status(DshStatus::Error {
                    message: "DSH 启动超时（30秒内未就绪）".into(),
                });
                // 杀掉卡住的进程
                self.kill_child();
                return Err("DSH 启动超时".into());
            }

            if is_port_ready(port) {
                break;
            }

            // 检查进程是否已经挂了
            {
                let mut child_guard = self.child.lock().unwrap();
                if let Some(ref mut child) = *child_guard {
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            let msg = format!("DSH 进程意外退出，退出码: {}", status);
                            self.set_status(DshStatus::Error {
                                message: msg.clone(),
                            });
                            return Err(msg);
                        }
                        Ok(None) => {} // 还在跑
                        Err(_) => {}
                    }
                }
            }

            sleep(Duration::from_millis(500)).await;
            retries += 1;
        }

        self.set_status(DshStatus::Running { port });
        Ok(port)
    }

    /// 停止 DSH 进程
    pub fn stop(&self) -> Result<(), String> {
        self.set_status(DshStatus::Stopping);
        self.kill_child();
        self.set_status(DshStatus::Idle);
        *self.port.lock().unwrap() = None;
        Ok(())
    }

    fn kill_child(&self) {
        let mut child_guard = self.child.lock().unwrap();
        if let Some(ref mut child) = *child_guard {
            let _ = child.kill();
            let _ = child.wait();
        }
        *child_guard = None;
    }
}

/// 检查端口是否就绪（HTTP 200）
fn is_port_ready(port: u16) -> bool {
    let addr = format!("http://127.0.0.1:{}", port);
    match ureq::get(&addr).timeout(Duration::from_secs(2)).call() {
        Ok(resp) => resp.status() == 200,
        Err(_) => false,
    }
}

/// 全局单例
pub static DSH_MANAGER: Lazy<DshManager> = Lazy::new(DshManager::new);

/// 初始化 DSH 管理器（异步启动）
pub fn init<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    // 后台异步启动 DSH
    tauri::async_runtime::spawn(async move {
        match DSH_MANAGER.start().await {
            Ok(port) => {
                log::info!("DSH 启动成功，端口: {}", port);
                // 发送事件给前端
                let _ = app_handle.emit("dsh-ready", port);
            }
            Err(e) => {
                log::error!("DSH 启动失败: {}", e);
                let _ = app_handle.emit("dsh-error", e);
            }
        }
    });

    Ok(())
}
