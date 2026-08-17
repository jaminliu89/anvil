// dock-adapter — 异步编码调度（worktree 隔离 + 两段审批）
// 走 dock_api.py (:8710) HTTP 接口

import type { Adapter, ExecutionResult } from './types'

const DOCK_API = 'http://127.0.0.1:8710'

interface DockSession {
  sid: string
  state: string
  title?: string
  source?: string
}

async function dockGet<T>(path: string): Promise<T> {
  const res = await fetch(`${DOCK_API}${path}`)
  if (!res.ok) throw new Error(`dock API ${res.status}`)
  return res.json()
}

async function dockPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${DOCK_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  if (!res.ok) throw new Error(`dock API ${res.status}`)
  return res.json()
}

function getDefaultRepo(): string {
  return localStorage.getItem('anvil-dock-repo') || ''
}

async function setRepoCmd(path: string): Promise<import('./types').ExecutionResult> {
  if (!path) return { type: 'system', content: `当前 repo: ${getDefaultRepo() || '(未设置)'}` }
  localStorage.setItem('anvil-dock-repo', path)
  return { type: 'system', content: `默认仓库已设为 ${path}` }
}

export const dockAdapter: Adapter = {
  id: 'dock',
  name: 'dock',
  description: '异步编码调度。worktree 隔离，计划审批后执行。',
  commands: ['dock', 'd'],
  capabilities: [
    { type: 'plan', provider: 'structured', description: '生成编码计划，批准后执行' },
    { type: 'execute', provider: 'async', description: '后台执行，结果返回时间线' },
    { type: 'inspect', provider: 'sync', description: 'session 状态/日志' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()

    // 子命令检测：approve/status/log/pr/repo 开头才算子命令，否则整段当 prompt
    const subMatch = trimmed.match(/^(approve|status|log|pr|repo)\s*(.*)$/)

    if (subMatch) {
      const sub = subMatch[1]
      const rest = subMatch[2].trim().split(/\s+/)[0] || ''
      const restAll = subMatch[2].trim()
      switch (sub) {
        case 'status': return sessionList()
        case 'approve': return approveSession(rest)
        case 'log': return sessionLog(rest)
        case 'pr': return createPR(rest)
        case 'repo': return setRepoCmd(restAll)
      }
    }

    // /dock repo（无参）查询
    if (trimmed === 'repo') {
      return { type: 'system', content: `当前 repo: ${getDefaultRepo() || '(未设置)'}` }
    }

    if (!trimmed) {
      return { type: 'system', content: '用法: /dock <任务描述>，或 /dock approve|status|log|pr|repo' }
    }

    return createSession(trimmed)
  },

  render() { /* TimelineView 内联渲染 */ },

  async status() {
    try {
      const sessions = await dockGet<DockSession[]>('/api/sessions')
      return {
        available: true,
        healthy: true,
        message: `dock 在线，${sessions.length} 个 session`,
      }
    } catch {
      return { available: false, healthy: false, message: 'dock API 未启动 (:8710)' }
    }
  },
}

async function createSession(prompt: string): Promise<ExecutionResult> {
  let repo = getDefaultRepo()
  if (!repo) {
    return {
      type: 'system',
      content: '还没设置默认仓库。先用 /dock repo <路径> 设置。',
    }
  }

  try {
    const r = await dockPost<{ sid: string; branch: string }>('/api/sessions', {
      repo,
      prompt,
      auto: false,
    })

    const plan = await pollPlan(r.sid)

    return {
      type: 'plan',
      title: prompt.slice(0, 60),
      content: '',
      steps: plan.steps.map((s, i) => ({ id: `s${i}`, title: s, status: 'pending' as const })),
      sessionId: r.sid,
      branch: r.branch,
    }
  } catch (e) {
    return { type: 'system', content: `dock 创建失败: ${e}` }
  }
}

async function pollPlan(sid: string): Promise<{ steps: string[] }> {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const acts = await dockGet<{ kind: string; text?: string }[]>(`/api/sessions/${sid}/activities`)
      const planAct = acts.find(a => a.kind === 'planReady' || a.kind === 'plan')
      if (planAct?.text) {
        return { steps: planAct.text.split('\n').filter((l: string) => l.trim()) }
      }
      // 已经在执行/完成，直接停
      const done = acts.find(a => a.kind === 'phaseStarted' || a.kind === 'executionComplete')
      if (done) return { steps: ['（已进入执行阶段）'] }
    } catch { /* retry */ }
  }
  return { steps: ['（计划生成超时，用 /dock status 查看状态）'] }
}

async function approveSession(sid: string): Promise<ExecutionResult> {
  if (!sid) return { type: 'system', content: '用法: /dock approve <sid>' }
  try {
    await dockPost(`/api/sessions/${sid}/approve`)
    return { type: 'execution', content: `已批准 ${sid}，执行中。用 /dock log ${sid} 看日志。` }
  } catch (e) {
    return { type: 'system', content: `批准失败: ${e}` }
  }
}

async function sessionList(): Promise<ExecutionResult> {
  try {
    const sessions = await dockGet<DockSession[]>('/api/sessions')
    if (sessions.length === 0) {
      return { type: 'execution', content: '没有 dock session。用 /dock <任务> 创建。' }
    }
    const lines = sessions.map(s =>
      `${s.sid.slice(0, 14)}  ${(s.state || '?').padEnd(20)}  ${s.title || ''}`
    )
    return { type: 'execution', content: lines.join('\n') }
  } catch (e) {
    return { type: 'system', content: `查询失败: ${e}` }
  }
}

async function sessionLog(sid: string): Promise<ExecutionResult> {
  if (!sid) return { type: 'system', content: '用法: /dock log <sid>' }
  try {
    const log = await dockGet<{ log: string }>(`/api/sessions/${sid}/log`)
    return { type: 'log', content: (log.log || '').slice(-3000) }
  } catch (e) {
    return { type: 'system', content: `读取日志失败: ${e}` }
  }
}

async function createPR(sid: string): Promise<ExecutionResult> {
  if (!sid) return { type: 'system', content: '用法: /dock pr <sid>' }
  try {
    const r = await dockPost<{ url: string }>(`/api/sessions/${sid}/pr`)
    return { type: 'pr', content: `PR 已创建: ${r.url}` }
  } catch (e) {
    return { type: 'system', content: `PR 创建失败: ${e}` }
  }
}