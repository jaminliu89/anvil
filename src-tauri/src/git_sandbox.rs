//! Git 沙箱 — 本地模型编码的隔离环境
//!
//! 核心原则：
//! 1. 所有改动只在临时分支上，绝不碰当前分支
//! 2. 自动生成 commit，方便回滚
//! 3. 合并必须由人或云端模型审批
//! 4. 失败时自动清理分支

use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize)]
pub struct SandboxResult {
    pub success: bool,
    pub branch: String,
    pub message: String,
    pub diff: Option<String>,
    pub commit_hash: Option<String>,
}

#[derive(Serialize)]
pub struct BranchInfo {
    pub current: String,
    pub branches: Vec<String>,
}

/// 在指定 repo 里创建沙箱分支并切入
/// 返回沙箱分支名
fn create_sandbox_branch(repo: &str, slug: &str) -> Result<String, String> {
    let ts = chrono_timestamp();
    let branch_name = format!("local-model/{}-{}", slug, ts);

    // 先确保工作区干净（有未提交改动就报错，不碰用户工作）
    let status = run_git(repo, &["status", "--porcelain"])?;
    if !status.trim().is_empty() {
        return Err("工作区有未提交改动，先 commit 或 stash 再用本地模型编码".into());
    }

    // 获取当前分支名
    let current = run_git(repo, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();

    // 从当前分支切出新分支
    run_git(repo, &["checkout", "-b", &branch_name])?;

    log::info!("[git-sandbox] created branch: {} (from {})", branch_name, current);
    Ok(branch_name)
}

/// 切回原分支并删除沙箱分支（丢弃改动）
pub fn discard_sandbox(repo: &str, branch: &str) -> Result<String, String> {
    // 先看当前在哪个分支
    let current = run_git(repo, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();

    if current == branch {
        // 还在沙箱分支上，先切走
        // 切到上一个分支（HEAD@{-1}），失败就切 main
        let prev = run_git(repo, &["rev-parse", "--verify", "HEAD@{-1}"]).ok();
        if prev.is_some() {
            run_git(repo, &["checkout", "-"])?;
        } else {
            run_git(repo, &["checkout", "main"]).or_else(|_| {
                run_git(repo, &["checkout", "master"])
            })?;
        }
    }

    // 删分支
    run_git(repo, &["branch", "-D", branch])?;
    log::info!("[git-sandbox] discarded branch: {}", branch);
    Ok(format!("已删除分支 {}", branch))
}

/// 把沙箱分支合并到当前分支（人审通过后调用）
pub fn merge_sandbox(repo: &str, branch: &str) -> Result<String, String> {
    let current = run_git(repo, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();

    if current == branch {
        return Err("当前就在沙箱分支上，先切到目标分支再合并".into());
    }

    // --no-ff 保留合并提交，方便追踪哪些改动是本地模型做的
    run_git(repo, &["merge", "--no-ff", branch, "-m", &format!("merge: {}", branch)])?;
    log::info!("[git-sandbox] merged {} into {}", branch, current);
    Ok(format!("已合并 {} → {}", branch, current))
}

/// 获取两个分支间的 diff
pub fn get_diff(repo: &str, base_branch: &str, sandbox_branch: &str) -> Result<String, String> {
    let diff = run_git(
        repo,
        &["diff", &format!("{}..{}", base_branch, sandbox_branch)],
    )?;
    Ok(diff)
}

/// 在当前分支应用文件改动（写入文件内容）
/// 每个文件改动：(file_path, new_content)
pub fn apply_file_changes(repo: &str, changes: &[(String, String)]) -> Result<usize, String> {
    let repo_path = PathBuf::from(repo);
    let mut count = 0;

    for (file_path, content) in changes {
        let full_path = repo_path.join(file_path);
        // 确保父目录存在
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
        std::fs::write(&full_path, content).map_err(|e| format!("写入 {} 失败: {}", file_path, e))?;
        count += 1;
    }

    Ok(count)
}

/// 提交当前所有改动
pub fn commit_all(repo: &str, message: &str) -> Result<String, String> {
    run_git(repo, &["add", "-A"])?;
    // 检查是否有改动要提交
    let status = run_git(repo, &["status", "--porcelain"])?;
    if status.trim().is_empty() {
        return Ok("no changes".into());
    }
    run_git(repo, &["commit", "-m", message])?;
    let hash = run_git(repo, &["rev-parse", "HEAD"])?.trim().to_string();
    Ok(hash)
}

/// 获取当前分支名
pub fn current_branch(repo: &str) -> Result<String, String> {
    Ok(run_git(repo, &["rev-parse", "--abbrev-ref", "HEAD"])?.trim().to_string())
}

/// 列出所有本地分支
pub fn list_branches(repo: &str) -> Result<Vec<String>, String> {
    let output = run_git(repo, &["branch", "--list", "--format=%(refname:short)"])?;
    Ok(output.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
}

// ── 工具函数 ──────────────────────────────────────────────

fn run_git(repo: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo)
        .output()
        .map_err(|e| format!("git 执行失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git {} 失败: {}", args.join(" "), stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn chrono_timestamp() -> String {
    // 简单时间戳，不用 chrono 依赖
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{:x}", secs)
}

// ── Tauri Commands ────────────────────────────────────────

#[tauri::command]
pub fn sandbox_create(repo: String, slug: String) -> Result<SandboxResult, String> {
    match create_sandbox_branch(&repo, &slug) {
        Ok(branch) => Ok(SandboxResult {
            success: true,
            message: format!("沙箱分支已创建: {}", branch),
            branch: branch.clone(),
            diff: None,
            commit_hash: None,
        }),
        Err(e) => Ok(SandboxResult {
            success: false,
            branch: String::new(),
            message: e,
            diff: None,
            commit_hash: None,
        }),
    }
}

#[tauri::command]
pub fn sandbox_discard(repo: String, branch: String) -> Result<SandboxResult, String> {
    match discard_sandbox(&repo, &branch) {
        Ok(msg) => Ok(SandboxResult {
            success: true,
            branch: branch.clone(),
            message: msg,
            diff: None,
            commit_hash: None,
        }),
        Err(e) => Ok(SandboxResult {
            success: false,
            branch,
            message: e,
            diff: None,
            commit_hash: None,
        }),
    }
}

#[tauri::command]
pub fn sandbox_merge(repo: String, branch: String) -> Result<SandboxResult, String> {
    match merge_sandbox(&repo, &branch) {
        Ok(msg) => Ok(SandboxResult {
            success: true,
            branch: branch.clone(),
            message: msg,
            diff: None,
            commit_hash: None,
        }),
        Err(e) => Ok(SandboxResult {
            success: false,
            branch,
            message: e,
            diff: None,
            commit_hash: None,
        }),
    }
}

#[tauri::command]
pub fn sandbox_diff(repo: String, base_branch: String, sandbox_branch: String) -> Result<String, String> {
    get_diff(&repo, &base_branch, &sandbox_branch)
}

#[tauri::command]
pub fn sandbox_apply_and_commit(
    repo: String,
    changes: Vec<(String, String)>,
    message: String,
) -> Result<SandboxResult, String> {
    // 1. 应用文件改动
    let count = match apply_file_changes(&repo, &changes) {
        Ok(c) => c,
        Err(e) => {
            return Ok(SandboxResult {
                success: false,
                branch: current_branch(&repo).unwrap_or_default(),
                message: format!("应用改动失败: {}", e),
                diff: None,
                commit_hash: None,
            });
        }
    };

    // 2. 提交
    let branch = current_branch(&repo).unwrap_or_default();
    match commit_all(&repo, &message) {
        Ok(hash) => {
            // 3. 生成 diff（相对于 HEAD~1）
            let diff = run_git(&repo, &["show", "--stat", "HEAD"]).ok();
            Ok(SandboxResult {
                success: true,
                branch,
                message: format!("已修改 {} 个文件", count),
                diff,
                commit_hash: if hash == "no changes" { None } else { Some(hash) },
            })
        }
        Err(e) => Ok(SandboxResult {
            success: false,
            branch,
            message: format!("提交失败: {}", e),
            diff: None,
            commit_hash: None,
        }),
    }
}

#[tauri::command]
pub fn sandbox_current_branch(repo: String) -> Result<String, String> {
    current_branch(&repo)
}

#[tauri::command]
pub fn sandbox_list_branches(repo: String) -> Result<BranchInfo, String> {
    let current = current_branch(&repo)?;
    let branches = list_branches(&repo)?;
    Ok(BranchInfo { current, branches })
}
