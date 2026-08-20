// claude-adapter — Claude Code 异步编码 Agent
// 通过 bridge sidecar 代理调用 claude CLI
// 异步任务：创建 → 计划 → 批准 → 执行 → 结果

import type { Adapter, ExecutionResult } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

export const claudeAdapter: Adapter = {
  id: 'claude',
  name: 'Claude Code',
  description: 'Anthropic Claude Code 编码 Agent。最强代码理解与重构能力。',
  commands: ['claude'],
  capabilities: [
    { type: 'plan', provider: 'structured', description: '生成编码计划，批准后执行' },
    { type: 'execute', provider: 'async', description: '后台执行，结果返回时间线' },
    { type: 'inspect', provider: 'sync', description: 'session 状态/日志' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()

    // 子命令
    const subMatch = trimmed.match(/^(status|log|approve|pr)\s+(\S+)\s*(.*)$/)
    if (subMatch) {
      const sub = subMatch[1]
      const sid = subMatch[2]
      switch (sub) {
        case 'status':
          return sessionStatus(sid)
        case 'log':
          return sessionLog(sid)
        case 'approve':
          return approveSession(sid)
        case 'pr':
          return createPR(sid)
      }
    }

    if (!trimmed) {
      return { type: 'system', content: '用法: /claude <任务描述>' }
    }

    // 创建任务
    return createSession(trimmed)
  },

  async status() {
    try {
      const res = await fetch(`${BRIDGE}/claude/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        return { available: true, healthy: true, message: data.message || 'Claude Code 可用' }
      }
    } catch { /* fall through */ }
    return { available: false, healthy: false, message: 'Claude Code 未连接（需 bridge 代理）' }
  },
}

async function createSession(prompt: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/claude/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = await res.json()
    return {
      type: 'plan',
      title: prompt.slice(0, 60),
      content: prompt,
      sessionId: data.sid,
      steps: data.steps?.map((s: { id?: string; title: string; status?: string }, i: number) => ({
        id: s.id || `s${i}`,
        title: s.title,
        status: (s.status || 'pending') as 'pending' | 'running' | 'done' | 'failed',
      })) || [{ id: 's0', title: '任务创建中...', status: 'running' as const }],
      approved: !!data.approved,
      data: { status: data.status || 'awaiting-approval' },
    }
  } catch (e) {
    return { type: 'system', content: `Claude Code 暂不可用: ${e}` }
  }
}

async function sessionStatus(sid: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/claude/status/${sid}`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    return { type: 'execution', content: JSON.stringify(data, null, 2) }
  } catch (e) {
    return { type: 'system', content: `查询失败: ${e}` }
  }
}

async function sessionLog(sid: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/claude/log/${sid}`, { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    return { type: 'log', content: data.log || '' }
  } catch (e) {
    return { type: 'system', content: `读取日志失败: ${e}` }
  }
}

async function approveSession(sid: string): Promise<ExecutionResult> {
  try {
    await fetch(`${BRIDGE}/claude/approve/${sid}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
    return { type: 'execution', content: `已批准 ${sid}，执行中。` }
  } catch (e) {
    return { type: 'system', content: `批准失败: ${e}` }
  }
}

async function createPR(sid: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/claude/pr/${sid}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    return { type: 'pr', content: data.url || 'PR 已创建' }
  } catch (e) {
    return { type: 'system', content: `PR 创建失败: ${e}` }
  }
}
