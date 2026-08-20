// local-coding-adapter — 本地模型编码（Ollama + git 沙箱）
//
// 核心机制：
// 1. 任务分级 → 简单任务才走本地模型
// 2. 自动切沙箱分支 → 生成代码 → 自动 commit
// 3. 返回 diff + 人审门禁（合/弃）
// 4. 绝不碰用户当前分支
//
// 模型：走 Ollama OpenAI 兼容接口 (/v1/chat/completions)
// 模型名可配置，默认用 ollama list 第一个可用的

import type { Adapter, ExecutionResult, Message, ChatOpts, ChatResult } from './types'
import { invoke } from '@tauri-apps/api/core'

const OLLAMA_BASE = 'http://127.0.0.1:11434'

// 任务分级阈值
const SIMPLE_KEYWORDS = [
  // 格式化/风格类
  '格式化', '格式调整', '美化', '缩进', '换行', '注释', '加注释',
  // 简单改动
  '改个', '改一下', '调整', '修改', '替换', '重命名', '改名',
  // 配置/文案类
  '文案', '标题', '改字', '改文字', '配置', '改配置', '常量',
  // 辅助类
  '日志', '加个日志', 'debug', '打印', 'console.log',
  // 新增小功能（单文件）
  '加个函数', '加个方法', '加个工具', '写个工具函数',
]

const COMPLEX_KEYWORDS = [
  '重构', '架构', '系统', '框架', '跨文件', '多文件',
  '新增功能', '新功能', '模块', '组件', '插件',
  '数据库', '表', 'migration', 'API', '接口设计',
  '部署', '发布', 'CI', '测试用例', '集成',
  '登录', '鉴权', '权限', '支付',
]

interface SandboxResult {
  success: boolean
  branch: string
  message: string
  diff?: string
  commit_hash?: string
}

function getDefaultRepo(): string {
  return localStorage.getItem('anvil-local-coding-repo') || ''
}

function getDefaultModel(): string {
  return localStorage.getItem('anvil-local-coding-model') || 'gemma3:4b'
}

/**
 * 任务分级：判断是否属于本地模型能搞定的简单任务
 * 返回 'simple' | 'complex'
 */
export function classifyTask(prompt: string): 'simple' | 'complex' {
  const text = prompt.toLowerCase()

  // 长度判断：超过 300 字大概率是复杂任务
  if (text.length > 300) return 'complex'

  // 复杂关键词命中
  for (const kw of COMPLEX_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) return 'complex'
  }

  // 简单关键词命中
  for (const kw of SIMPLE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) return 'simple'
  }

  // 太短（<20字）且没有复杂关键词，判简单
  if (text.length < 20) return 'simple'

  // 默认判复杂（安全第一，本地模型不冒险）
  return 'complex'
}

/**
 * 调 Ollama 生成文件改动
 * prompt + 上下文 → 返回改动描述 + 改动文件列表
 *
 * 输出格式（让模型尽量输出结构化 JSON）：
 * {
 *   "summary": "一句话总结改动",
 *   "files": [
 *     { "path": "src/foo.ts", "content": "完整文件内容..." }
 *   ]
 * }
 */
async function generateCodeChanges(
  prompt: string,
  repo: string,
): Promise<{ summary: string; files: { path: string; content: string }[] }> {
  const model = getDefaultModel()
  const systemPrompt = `你是一个编码助手。你只能修改指定仓库里的文件。

规则：
1. 只输出 JSON，不要其他文字
2. JSON 格式: {"summary": "...", "files": [{"path": "相对路径", "content": "完整文件内容"}]}
3. 必须给出每个被修改文件的完整内容，不是 diff
4. 路径必须是相对于项目根目录的相对路径
5. 不要凭空创建新文件，除非用户明确要求
6. 改动要最小化，不要顺手优化其他东西`

  const userPrompt = `仓库路径: ${repo}

任务: ${prompt}

请输出 JSON 格式的改动方案。`

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: {
          temperature: 0.2,
          num_predict: 4096,
        },
      }),
      signal: AbortSignal.timeout(180_000),
    })

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}`)
    }

    const data = await res.json()
    const content = data.message?.content || ''

    // 尝试从内容里提取 JSON
    return parseCodeChanges(content)
  } catch (e) {
    throw new Error(`本地模型生成失败: ${(e as Error).message}`)
  }
}

function parseCodeChanges(text: string): {
  summary: string
  files: { path: string; content: string }[]
} {
  // 尝试直接解析
  try {
    const json = JSON.parse(text)
    if (json.files && Array.isArray(json.files)) {
      return {
        summary: json.summary || '改动完成',
        files: json.files.filter((f: any) => f.path && f.content !== undefined),
      }
    }
  } catch { /* fall through */ }

  // 尝试提取 ```json 代码块
  const match = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
  if (match) {
    try {
      const json = JSON.parse(match[1])
      if (json.files && Array.isArray(json.files)) {
        return {
          summary: json.summary || '改动完成',
          files: json.files.filter((f: any) => f.path && f.content !== undefined),
        }
      }
    } catch { /* fall through */ }
  }

  // 解析失败
  return { summary: '无法解析模型输出', files: [] }
}

/**
 * 执行本地编码完整流程：
 * 1. 任务分级（如果是复杂任务直接返回提示）
 * 2. 建沙箱分支
 * 3. 生成改动
 * 4. 应用并 commit
 * 5. 返回 approval entry 等人审
 */
async function runLocalCoding(prompt: string): Promise<ExecutionResult> {
  const repo = getDefaultRepo()
  if (!repo) {
    return {
      type: 'system',
      content: '还没设置默认仓库。先用 /local repo <路径> 设置。',
    }
  }

  // 1. 任务分级
  const level = classifyTask(prompt)
  if (level === 'complex') {
    return {
      type: 'system',
      content:
        '这个任务复杂度较高，本地模型可能搞不定。建议用 /pi 或 /codex 等云端模型来做。\n\n' +
        '如果你确定要让本地模型试试，用 /local force <任务> 强制执行。',
    }
  }

  return executeSandboxFlow(prompt, repo)
}

async function executeSandboxFlow(prompt: string, repo: string): Promise<ExecutionResult> {
  const slug = prompt.slice(0, 20).replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '-').toLowerCase()

  // 1. 记录原分支
  let originalBranch = ''
  try {
    originalBranch = await invoke<string>('sandbox_current_branch', { repo })
  } catch {
    originalBranch = 'main'
  }

  // 2. 建沙箱分支
  let sandboxResult: SandboxResult
  try {
    sandboxResult = await invoke<SandboxResult>('sandbox_create', { repo, slug })
  } catch (e) {
    return { type: 'system', content: `创建沙箱失败: ${e}` }
  }

  if (!sandboxResult.success) {
    return { type: 'system', content: `创建沙箱失败: ${sandboxResult.message}` }
  }

  const sandboxBranch = sandboxResult.branch

  try {
    // 3. 生成代码改动
    const changes = await generateCodeChanges(prompt, repo)

    if (!changes.files || changes.files.length === 0) {
      // 没生成改动，清理沙箱
      await invoke<SandboxResult>('sandbox_discard', { repo, branch: sandboxBranch }).catch(() => {})
      return {
        type: 'system',
        content:
          '本地模型没有生成有效的改动。可能是模型能力不够，建议换云端模型。\n\n' +
          `（沙箱分支 ${sandboxBranch} 已自动清理）`,
      }
    }

    // 4. 应用并提交
    const commitResult = await invoke<SandboxResult>('sandbox_apply_and_commit', {
      repo,
      changes: changes.files.map(f => [f.path, f.content] as [string, string]),
      message: `local-model: ${changes.summary || prompt.slice(0, 50)}`,
    })

    if (!commitResult.success) {
      await invoke<SandboxResult>('sandbox_discard', { repo, branch: sandboxBranch }).catch(() => {})
      return {
        type: 'system',
        content:
          `应用改动失败: ${commitResult.message}\n\n` +
          `（沙箱分支 ${sandboxBranch} 已自动清理）`,
      }
    }

    // 5. 切回原分支（不能让人在沙箱分支上）
    try {
      // 通过 git_sandbox 侧的方式切换——先看当前分支确认能操作
      // 用 shell 插件切回原分支
      const { Command } = await import('@tauri-apps/plugin-shell')
      await Command.create('git', ['checkout', originalBranch], { cwd: repo }).execute()
    } catch {
      // 切不回去也要继续，至少分支还在
    }

    // 6. 获取 diff
    let diff = ''
    try {
      diff = await invoke<string>('sandbox_diff', {
        repo,
        baseBranch: originalBranch,
        sandboxBranch,
      })
    } catch {
      diff = '(无法获取 diff)'
    }

    // 7. 返回 approval entry
    return {
      type: 'approval',
      title: changes.summary || prompt.slice(0, 60),
      content: diff.slice(0, 8000),
      sessionId: sandboxBranch,
      branch: sandboxBranch,
      approved: false,
      data: {
        repo,
        originalBranch,
        sandboxBranch,
        summary: changes.summary,
        fileCount: changes.files.length,
        commitHash: commitResult.commit_hash,
        status: 'awaiting-approval',
      },
    }
  } catch (e) {
    // 出错了清理沙箱
    await invoke<SandboxResult>('sandbox_discard', { repo, branch: sandboxBranch }).catch(() => {})
    return {
      type: 'system',
      content:
        `本地编码失败: ${(e as Error).message}\n\n` +
        `（沙箱分支 ${sandboxBranch} 已自动清理）`,
    }
  }
}

// ── Adapter 定义 ──────────────────────────────────────────

export const localCodingAdapter: Adapter = {
  id: 'local-coding',
  name: '本地编码',
  description: '本地模型编码（Ollama + git 沙箱）。只处理简单任务，复杂任务自动拒绝。',
  commands: ['local', 'local-coding'],
  capabilities: [
    { type: 'execute', provider: 'sync', description: '本地模型编码，自动沙箱分支，人审门禁' },
    { type: 'inspect', provider: 'sync', description: '本地模型状态/仓库配置' },
  ],

  async chat(_history: Message[], _prompt: string, _opts?: ChatOpts): Promise<ChatResult> {
    // 本地模型聊天走 ollama-adapter，这里只做编码
    return { content: '本地编码不支持聊天。用 /local <任务> 来修改代码。', reasoning: '' }
  },

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()

    // 子命令
    if (trimmed.startsWith('repo')) {
      const rest = trimmed.slice(4).trim()
      if (!rest) {
        return { type: 'system', content: `当前仓库: ${getDefaultRepo() || '(未设置)'}` }
      }
      localStorage.setItem('anvil-local-coding-repo', rest)
      return { type: 'system', content: `默认仓库已设为 ${rest}` }
    }

    if (trimmed.startsWith('model')) {
      const rest = trimmed.slice(5).trim()
      if (!rest) {
        return { type: 'system', content: `当前模型: ${getDefaultModel()}` }
      }
      localStorage.setItem('anvil-local-coding-model', rest)
      return { type: 'system', content: `本地编码模型已设为 ${rest}` }
    }

    if (trimmed.startsWith('models') || trimmed.startsWith('list')) {
      return listOllamaModels()
    }

    if (trimmed.startsWith('approve')) {
      const branch = trimmed.slice(7).trim()
      return approveSandbox(branch)
    }

    if (trimmed.startsWith('discard') || trimmed.startsWith('reject')) {
      const branch = trimmed.slice(trimmed.startsWith('discard') ? 7 : 6).trim()
      return discardSandbox(branch)
    }

    if (trimmed.startsWith('force')) {
      const rest = trimmed.slice(5).trim()
      if (!rest) {
        return { type: 'system', content: '用法: /local force <任务描述>（强制本地模型处理，跳过任务分级）' }
      }
      const repo = getDefaultRepo()
      if (!repo) {
        return { type: 'system', content: '还没设置默认仓库。先用 /local repo <路径> 设置。' }
      }
      return executeSandboxFlow(rest, repo)
    }

    if (trimmed.startsWith('status')) {
      return statusCheck()
    }

    if (!trimmed) {
      return {
        type: 'system',
        content:
          '本地模型编码（git 沙箱 + 人审门禁）\n\n' +
          '用法:\n' +
          '  /local <任务描述>        简单编码任务（自动分级）\n' +
          '  /local force <任务>      强制用本地模型（跳过分级）\n' +
          '  /local approve <分支>    批准并合并沙箱分支\n' +
          '  /local discard <分支>    丢弃沙箱分支\n' +
          '  /local repo <路径>       设置默认仓库\n' +
          '  /local model <名称>      设置编码模型\n' +
          '  /local models            列出 Ollama 模型\n' +
          '  /local status            检查本地模型状态',
      }
    }

    // 默认：执行编码任务
    return runLocalCoding(trimmed)
  },

  async status() {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const data = await res.json()
        const count = data.models?.length || 0
        return {
          available: true,
          healthy: count > 0,
          message: count > 0 ? `Ollama 在线，${count} 个模型` : 'Ollama 在线，但没有模型',
        }
      }
    } catch { /* fall through */ }
    return { available: false, healthy: false, message: 'Ollama 未启动 (:11434)' }
  },
}

// ── 子命令实现 ────────────────────────────────────────────

async function listOllamaModels(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const models = data.models || []
    if (models.length === 0) {
      return { type: 'system', content: 'Ollama 里没有模型。先 ollama pull 一个。' }
    }
    const current = getDefaultModel()
    const lines = models.map((m: { name: string; size?: number }) => {
      const mark = m.name === current ? ' *' : '  '
      return `${mark}${m.name}`
    })
    return { type: 'system', content: `本地模型（* = 当前编码模型）:\n${lines.join('\n')}` }
  } catch (e) {
    return { type: 'system', content: `获取模型列表失败: ${e}` }
  }
}

async function approveSandbox(branch: string): Promise<ExecutionResult> {
  const repo = getDefaultRepo()
  if (!repo) return { type: 'system', content: '先设置仓库: /local repo <路径>' }
  if (!branch) return { type: 'system', content: '用法: /local approve <分支名>' }

  try {
    const result = await invoke<SandboxResult>('sandbox_merge', { repo, branch })
    if (result.success) {
      // 合并后删掉沙箱分支
      await invoke<SandboxResult>('sandbox_discard', { repo, branch }).catch(() => {})
      return { type: 'execution', content: `✓ 已合并 ${branch} 到当前分支` }
    }
    return { type: 'system', content: `合并失败: ${result.message}` }
  } catch (e) {
    return { type: 'system', content: `合并失败: ${e}` }
  }
}

async function discardSandbox(branch: string): Promise<ExecutionResult> {
  const repo = getDefaultRepo()
  if (!repo) return { type: 'system', content: '先设置仓库: /local repo <路径>' }
  if (!branch) return { type: 'system', content: '用法: /local discard <分支名>' }

  try {
    const result = await invoke<SandboxResult>('sandbox_discard', { repo, branch })
    if (result.success) {
      return { type: 'execution', content: `✓ 已丢弃分支 ${branch}` }
    }
    return { type: 'system', content: `丢弃失败: ${result.message}` }
  } catch (e) {
    return { type: 'system', content: `丢弃失败: ${e}` }
  }
}

async function statusCheck(): Promise<ExecutionResult> {
  const repo = getDefaultRepo()
  const model = getDefaultModel()

  let ollamaStatus = '未检测到'
  let modelCount = 0
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const data = await res.json()
      modelCount = data.models?.length || 0
      ollamaStatus = `在线 (${modelCount} 个模型)`
    }
  } catch {
    ollamaStatus = '离线'
  }

  let currentBranch = 'N/A'
  if (repo) {
    try {
      currentBranch = await invoke<string>('sandbox_current_branch', { repo })
    } catch {
      currentBranch = '无法获取'
    }
  }

  const content =
    `Ollama:     ${ollamaStatus}\n` +
    `编码模型:   ${model}\n` +
    `默认仓库:   ${repo || '(未设置)'}\n` +
    `当前分支:   ${currentBranch}\n` +
    `\n` +
    `提示: 本地模型只处理简单任务。复杂任务自动拒绝，可用 /local force 强制执行。`

  return { type: 'system', content }
}
