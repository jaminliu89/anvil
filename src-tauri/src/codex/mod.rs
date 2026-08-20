//! Codex CLI 集成
//!
//! 通过 `codex exec <prompt>` 非交互执行编码任务。
//! 参考 pi-manager 模式，但 codex 是一次性执行，不需要常驻进程。

use serde::Serialize;
use std::process::Command;
use std::sync::Mutex;
use once_cell::sync::Lazy;

/// 运行中的 codex 子进程（同一时间只允许一个，防止并发抢资源）
static RUNNING: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

/// Codex 配额信息
#[derive(Serialize)]
pub struct CodexQuota {
    pub provider: String,
    pub model: String,
    pub note: String,
}

/// 执行 codex exec 命令
/// 返回 stdout（最多 10000 字）
#[tauri::command]
pub fn run_codex(prompt: String, cwd: Option<String>) -> Result<String, String> {
    // 防并发
    let running = RUNNING.lock().unwrap();
    if *running {
        return Err("codex 正在运行中，请稍候再试".into());
    }
    drop(running);

    let codex_bin = find_codex_binary().ok_or_else(|| "未找到 codex 可执行文件".to_string())?;

    // 标记运行中
    *RUNNING.lock().unwrap() = true;

    let result = (|| -> Result<String, String> {
        // 工作目录：用户指定 > 环境变量 PWD > 用户 home
        let work_dir = cwd
            .or_else(|| std::env::var("PWD").ok())
            .unwrap_or_else(|| {
                std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string())
            });

        let mut cmd = Command::new(&codex_bin);
        cmd
            .arg("exec")
            .arg(&prompt)
            .current_dir(&work_dir)
            // 注入需要的 API key
            .env("ARK_API_KEY", std::env::var("ARK_API_KEY").unwrap_or_default())
            .env("VOLC_ARK_API_KEY", std::env::var("VOLC_ARK_API_KEY").unwrap_or_default())
            .env("VOLC_ARK_API_KEY_V3", std::env::var("VOLC_ARK_API_KEY_V3").unwrap_or_default())
            .env("DEEPSEEK_API_KEY", std::env::var("DEEPSEEK_API_KEY").unwrap_or_default())
            .env("OPENAI_API_KEY", std::env::var("OPENAI_API_KEY").unwrap_or_default());

        log::info!("running codex exec in {} (prompt: {} chars)", work_dir, prompt.len());

        let output = cmd.output().map_err(|e| format!("启动 codex 失败: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            let err_msg = if stderr.is_empty() {
                format!("codex 执行失败 (exit {})", output.status)
            } else {
                format!("codex 执行失败: {}", stderr.trim().lines().last().unwrap_or("unknown error"))
            };
            return Err(err_msg);
        }

        // 最多返回 10000 字，防止前端卡
        let truncated = if stdout.len() > 10000 {
            format!("{}...\n\n（输出过长，已截断，完整 {}-bytes）", &stdout[..10000], stdout.len())
        } else {
            stdout
        };

        Ok(truncated)
    })();

    // 解除运行锁
    *RUNNING.lock().unwrap() = false;

    result
}

/// 获取 codex 配额/配置信息（简化版：读配置文件 + 状态）
/// 注：Codex CLI 没有直接的 quota 命令，这里返回当前 provider/model 配置
#[tauri::command]
pub fn get_codex_quota() -> Result<CodexQuota, String> {
    // 读 ~/.codex/config.toml 拿当前 provider 和 model
    let config_path = std::path::PathBuf::from(
        std::env::var("HOME").unwrap_or_else(|_| ".".into())
    ).join(".codex/config.toml");

    let (provider, model) = if config_path.exists() {
        match std::fs::read_to_string(&config_path) {
            Ok(content) => {
                let prov = extract_toml_value(&content, "model_provider");
                let mdl = extract_toml_value(&content, "model");
                (prov.unwrap_or_else(|| "unknown".into()), mdl.unwrap_or_else(|| "unknown".into()))
            }
            Err(_) => ("unknown".into(), "unknown".into()),
        }
    } else {
        ("unknown".into(), "unknown".into())
    };

    Ok(CodexQuota {
        provider,
        model,
        note: "codex 配额查询需调用火山 API，当前版本显示配置信息".into(),
    })
}

/// 从 toml 文本里提取简单的 key = "value"
fn extract_toml_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with(key) {
            let rest = line[key.len()..].trim();
            if rest.starts_with('=') {
                let val = rest[1..].trim();
                // 去掉引号
                let val = val.trim_matches('"').trim_matches('\'');
                return Some(val.to_string());
            }
        }
    }
    None
}

/// 查找 codex 可执行文件路径
fn find_codex_binary() -> Option<String> {
    let candidates = vec![
        "/Users/kimliu/.npm-global/bin/codex",
        "/usr/local/bin/codex",
        "/opt/homebrew/bin/codex",
    ];
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return Some(c.to_string());
        }
    }

    // PATH 里找
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(':') {
            let p = std::path::Path::new(dir).join("codex");
            if p.exists() {
                return Some(p.to_string_lossy().to_string());
            }
        }
    }

    None
}
