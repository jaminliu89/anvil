// hermes-adapter — Hermes Agent 本地研究/写作长任务
// 通过 bridge sidecar 代理调用 hermes CLI
// 异步执行，适合研究、写作、调研类长任务

import type { Adapter, ExecutionResult } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

export const hermesAdapter: Adapter = {
  id: 'hermes',
  name: 'Hermes Agent',
  description: '本地 Hermes Agent。研究、写作、调研类长任务。',
  commands: ['hermes'],
  capabilities: [
    { type: 'execute', provider: 'async', description: '后台执行长任务，结果返回时间线' },
    { type: 'inspect', provider: 'sync', description: '任务状态/日志' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()

    const subMatch = trimmed.match(/^(status|log)\s+(\S+)\s*(.*)$/)
    if (subMatch) {
      const sub = subMatch[1]
      const sid = subMatch[2]
      if (sub === 'status') return sessionStatus(sid)
      if (sub === 'log') return sessionLog(sid)
    }

    if (!trimmed) {
      return { type: 'system', content: '用法: /hermes <任务描述>' }
    }

    return createTask(trimmed)
  },

  async status() {
    try {
      const res = await fetch(`${BRIDGE}/hermes/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        return { available: true, healthy: true, message: data.message || 'Hermes Agent 可用' }
      }
    } catch { /* fall through */ }
    return { available: false, healthy: false, message: 'Hermes Agent 未连接（需 bridge 代理）' }
  },
}

async function createTask(prompt: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/hermes/create`, {
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
      steps: [{ id: 's0', title: '任务执行中...', status: 'running' as const }],
      approved: true,
      data: { status: 'running' },
    }
  } catch (e) {
    return { type: 'system', content: `Hermes Agent 暂不可用: ${e}` }
  }
}

async function sessionStatus(sid: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/hermes/status/${sid}`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    return { type: 'execution', content: JSON.stringify(data, null, 2) }
  } catch (e) {
    return { type: 'system', content: `查询失败: ${e}` }
  }
}

async function sessionLog(sid: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/hermes/log/${sid}`, { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    return { type: 'log', content: data.log || '' }
  } catch (e) {
    return { type: 'system', content: `读取日志失败: ${e}` }
  }
}
