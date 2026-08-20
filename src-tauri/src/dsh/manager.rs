//! Sidecar 进程管理器
//! 启动/停止/监控 Anvil sidecar（bridge.py，包 DSH 守卫）
//! 推理目标端点可路由：:18080（Ling-tiny）或 :8888（Unsloth）

use std::process::Child;
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use tauri::Emitter;
use tokio::time::sleep;

pub const SIDECAR_PORT: u16 = 18443;

/// Sidecar 状态
#[derive(Debug, Clone, PartialEq)]
pub enum SidecarStatus {
    Idle,
    Starting,
    Running { port: u16 },
    Stopping,
    Error { message: String },
}

/// 全局管理器
pub struct SidecarManager {
    status: Mutex<SidecarStatus>,
    child: Mutex<Option<Child>>,
    port: Mutex<Option<u16>>,
    target: Mutex<String>,
}

impl SidecarManager {
    const DEFAULT_TARGET: &'static str = "deepseek";

    const fn new() -> Self {
        Self {
            status: Mutex::new(SidecarStatus::Idle),
            child: Mutex::new(None),
            port: Mutex::new(None),
            target: Mutex::new(String::new()),
        }
    }

    pub fn get_status(&self) -> SidecarStatus {
        self.status.lock().unwrap().clone()
    }

    pub fn get_port(&self) -> Option<u16> {
        *self.port.lock().unwrap()
    }

    pub fn get_target(&self) -> String {
        let t = self.target.lock().unwrap().clone();
        if t.is_empty() { Self::DEFAULT_TARGET.to_string() } else { t }
    }

    /// 切换推理目标端点（重启 sidecar 生效）
    pub async fn set_target(&self, target: String) -> Result<(), String> {
        *self.target.lock().unwrap() = target;
        let _ = self.stop();
        self.start().await.map(|_| ())
    }

    fn set_status(&self, status: SidecarStatus) {
        *self.status.lock().unwrap() = status.clone();
        if let SidecarStatus::Running { port } = status {
            *self.port.lock().unwrap() = Some(port);
        }
    }

    /// 启动 sidecar
    pub async fn start(&self) -> Result<u16, String> {
        {
            let status = self.status.lock().unwrap();
            match *status {
                SidecarStatus::Running { .. } => {
                    return Ok(self.port.lock().unwrap().unwrap_or(0));
                }
                SidecarStatus::Starting => {
                    return Err("守卫服务正在启动中".into());
                }
                _ => {}
            }
        }

        self.set_status(SidecarStatus::Starting);

        // 若端口已被占用且健康，直接复用（dev 模式手跑的 sidecar）
        if is_port_ready(SIDECAR_PORT) {
            self.set_status(SidecarStatus::Running { port: SIDECAR_PORT });
            return Ok(SIDECAR_PORT);
        }

        let target = self.get_target();

        // 查找打包二进制或源码脚本
        let binary = find_binary();
        let child_result = if let Some(bin_path) = &binary {
            log::info!("using bundled sidecar: {}", bin_path.display());
            std::process::Command::new(bin_path)
                .env("DEEPSEEK_API_KEY", std::env::var("DEEPSEEK_API_KEY").unwrap_or_default())
                .env("SILICONFLOW_API_KEY", std::env::var("SILICONFLOW_API_KEY").unwrap_or_default())
                .env("TAVILY_API_KEY", std::env::var("TAVILY_API_KEY").unwrap_or_default())
                .arg("--port")
                .arg(SIDECAR_PORT.to_string())
                .arg("--target")
                .arg(&target)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
        } else {
            // 开发模式：源码路径；打包后：resource 目录
            let script_dev = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("sidecar/bridge.py");
            let script = if script_dev.exists() {
                script_dev
            } else if let Ok(exe) = std::env::current_exe() {
                // Anvil.app/Contents/Resources/sidecar/bridge.py
                let _ = exe;
                let candidates = vec![
                    std::path::PathBuf::from("sidecar/bridge.py"),
                    std::path::PathBuf::from("_up_/sidecar/bridge.py"),
                    std::path::PathBuf::from("Resources/sidecar/bridge.py"),
                ];
                let mut found = candidates[0].clone();
                for c in &candidates {
                    if c.exists() {
                        found = c.clone();
                        break;
                    }
                }
                found
            } else {
                std::path::PathBuf::from("sidecar/bridge.py")
            };
            let python = find_python();
            log::info!("no bundled sidecar, using python3: {}", python);
            std::process::Command::new(&python)
                .env("DEEPSEEK_API_KEY", std::env::var("DEEPSEEK_API_KEY").unwrap_or_default())
                .env("SILICONFLOW_API_KEY", std::env::var("SILICONFLOW_API_KEY").unwrap_or_default())
                .env("TAVILY_API_KEY", std::env::var("TAVILY_API_KEY").unwrap_or_default())
                .arg(script.to_string_lossy().to_string())
                .arg("--port")
                .arg(SIDECAR_PORT.to_string())
                .arg("--target")
                .arg(&target)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
        };

        let child = child_result.map_err(|e| {
            let msg = format!("启动守卫服务失败: {}", e);
            self.set_status(SidecarStatus::Error { message: msg.clone() });
            msg
        })?;

        *self.child.lock().unwrap() = Some(child);

        // 健康检查：最多 30 秒
        let max_retries = 60;
        let mut retries = 0;
        loop {
            if retries >= max_retries {
                self.set_status(SidecarStatus::Error {
                    message: "守卫服务启动超时".into(),
                });
                self.kill_child();
                return Err("守卫服务启动超时".into());
            }

            if is_port_ready(SIDECAR_PORT) {
                break;
            }

            {
                let mut child_guard = self.child.lock().unwrap();
                if let Some(ref mut child) = *child_guard {
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            let msg = format!("守卫服务意外退出: {}", status);
                            self.set_status(SidecarStatus::Error { message: msg.clone() });
                            return Err(msg);
                        }
                        Ok(None) => {}
                        Err(_) => {}
                    }
                }
            }

            sleep(Duration::from_millis(500)).await;
            retries += 1;
        }

        self.set_status(SidecarStatus::Running { port: SIDECAR_PORT });
        Ok(SIDECAR_PORT)
    }

    /// 停止
    pub fn stop(&self) -> Result<(), String> {
        self.set_status(SidecarStatus::Stopping);
        self.kill_child();
        self.set_status(SidecarStatus::Idle);
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

/// 查找打包的 sidecar 二进制
fn find_binary() -> Option<std::path::PathBuf> {
    // 开发模式：dist 目录
    let dev_bin = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("sidecar/dist/anvil-bridge");
    if dev_bin.exists() {
        return Some(dev_bin);
    }
    // 打包形态：同目录
    if let Ok(exe) = std::env::current_exe() {
        let bundled = exe.parent().unwrap().join("anvil-bridge");
        if bundled.exists() {
            return Some(bundled);
        }
    }
    None
}

fn find_python() -> String {
    // 依次尝试已知解释器（deepseek_harness 装在系统 Python）
    for cand in [
        "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3",
        "/usr/bin/python3",
        "python3",
    ] {
        if cand.starts_with('/') {
            if std::path::Path::new(cand).exists() {
                return cand.to_string();
            }
        } else {
            return cand.to_string();
        }
    }
    "python3".to_string()
}

fn is_port_ready(port: u16) -> bool {
    let addr = format!("http://127.0.0.1:{}/health", port);
    match ureq::get(&addr).timeout(Duration::from_secs(2)).call() {
        Ok(resp) => resp.status() == 200,
        Err(_) => false,
    }
}

/// 全局单例
pub static SIDECAR_MANAGER: Lazy<SidecarManager> = Lazy::new(SidecarManager::new);

/// 初始化（异步启动）
pub fn init<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        match SIDECAR_MANAGER.start().await {
            Ok(port) => {
                log::info!("sidecar ready on {}", port);
                let _ = app_handle.emit("sidecar-ready", port);
            }
            Err(e) => {
                log::error!("sidecar failed: {}", e);
                let _ = app_handle.emit("sidecar-error", e);
            }
        }
    });

    Ok(())
}