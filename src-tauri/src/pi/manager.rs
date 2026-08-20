//! Pi RPC 进程管理器
//! 启动 `pi --mode rpc`，通过 stdin/stdout JSONL 协议通信
//! 事件通过 Tauri event 推送到前端

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use once_cell::sync::Lazy;
use tauri::Emitter;

/// Pi 进程状态
#[derive(Debug, Clone, PartialEq)]
pub enum PiStatus {
    Idle,
    Starting,
    Running,
    Stopping,
    Error { message: String },
}

/// 全局单例
pub struct PiManager {
    status: Mutex<PiStatus>,
    child: Mutex<Option<Child>>,
    // child.stdin 用于发送命令
}

impl PiManager {
    const fn new() -> Self {
        Self {
            status: Mutex::new(PiStatus::Idle),
            child: Mutex::new(None),
        }
    }

    pub fn get_status(&self) -> PiStatus {
        self.status.lock().unwrap().clone()
    }

    fn set_status(&self, status: PiStatus) {
        *self.status.lock().unwrap() = status;
    }

    /// 启动 Pi RPC 进程
    pub async fn start<R: tauri::Runtime>(&self, app: &tauri::AppHandle<R>) -> Result<(), String> {
        {
            let status = self.status.lock().unwrap();
            match &*status {
                PiStatus::Running => return Ok(()),
                PiStatus::Starting => return Err("Pi 正在启动中".into()),
                _ => {}
            }
        }

        self.set_status(PiStatus::Starting);

        // 找到 pi 可执行文件
        let pi_bin = find_pi_binary().ok_or_else(|| {
            let msg = "未找到 pi 可执行文件".to_string();
            self.set_status(PiStatus::Error { message: msg.clone() });
            msg
        })?;

        log::info!("starting pi rpc: {}", pi_bin);

        // 启动子进程 — 必须显式注入所有需要的环境变量
        let mut cmd = Command::new(&pi_bin);
        cmd.arg("--mode")
            .arg("rpc")
            .arg("--no-session") // 会话由 Anvil 管理
            .env("GLM_CODING_KEY", std::env::var("GLM_CODING_KEY").unwrap_or_default())
            .env("DEEPSEEK_API_KEY", std::env::var("DEEPSEEK_API_KEY").unwrap_or_default())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            let msg = format!("启动 pi 失败: {}", e);
            self.set_status(PiStatus::Error { message: msg.clone() });
            msg
        })?;

        let stdout = child.stdout.take().ok_or("无法获取 pi stdout")?;
        let stderr = child.stderr.take().ok_or("无法获取 pi stderr")?;

        *self.child.lock().unwrap() = Some(child);

        self.set_status(PiStatus::Running);
        let app_clone = app.clone();

        // stdout 读线程：解析 JSONL 事件，emit 到前端
        tauri::async_runtime::spawn(async move {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) if !line.is_empty() => {
                        // 直接把原始 JSON 转发到前端
                        // 前端自己解析事件类型
                        let _ = app_clone.emit("pi-event", line);
                    }
                    Err(e) => {
                        log::error!("pi stdout read error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            log::info!("pi stdout closed");
        });

        // stderr 读线程：打日志
        let app_clone2 = app.clone();
        tauri::async_runtime::spawn(async move {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) if !line.is_empty() => {
                        log::debug!("pi stderr: {}", line);
                        let _ = app_clone2.emit("pi-stderr", line);
                    }
                    Err(e) => {
                        log::error!("pi stderr read error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        });

        // 等待 agent_start 事件确认进程就绪
        // 简单起见，直接返回 running，前端自己处理第一个事件
        Ok(())
    }

    /// 发送 prompt 到 Pi
    pub fn send_prompt(&self, message: &str) -> Result<(), String> {
        let mut child_guard = self.child.lock().unwrap();
        let child = child_guard.as_mut().ok_or("Pi 未运行")?;

        let stdin = child.stdin.as_mut().ok_or("无法获取 pi stdin")?;

        // 构造 prompt 命令
        let payload = serde_json::json!({
            "type": "prompt",
            "message": message,
        });

        let line = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
        writeln!(stdin, "{}", line).map_err(|e| format!("写入 pi stdin 失败: {}", e))?;
        stdin.flush().map_err(|e| format!("flush pi stdin 失败: {}", e))?;

        Ok(())
    }

    /// 停止 Pi 进程
    pub fn stop(&self) -> Result<(), String> {
        self.set_status(PiStatus::Stopping);
        let mut child_guard = self.child.lock().unwrap();
        if let Some(ref mut child) = *child_guard {
            let _ = child.kill();
            let _ = child.wait();
        }
        *child_guard = None;
        self.set_status(PiStatus::Idle);
        Ok(())
    }
}

/// 查找 pi 可执行文件
fn find_pi_binary() -> Option<String> {
    // 1. 常见 npm global 路径（用户的安装位置）
    let candidates = vec![
        "/Users/kimliu/.npm-global/bin/pi",
        "/usr/local/bin/pi",
        "/opt/homebrew/bin/pi",
    ];
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return Some(c.to_string());
        }
    }

    // 2. 从 PATH 环境变量找
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(':') {
            let pi_path = std::path::Path::new(dir).join("pi");
            if pi_path.exists() {
                return Some(pi_path.to_string_lossy().to_string());
            }
        }
    }

    None
}

/// 全局单例
pub static PI_MANAGER: Lazy<PiManager> = Lazy::new(PiManager::new);

/// 初始化（不自动启动，按需启动）
pub fn init<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Pi 不自动启动，用户发编码任务时再启
    Ok(())
}
