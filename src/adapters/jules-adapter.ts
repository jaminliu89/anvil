// jules-adapter — Google Jules 云端异步编码 Agent
// 三段式：new → 轮询（list）→ pull
// 通过 bridge sidecar 代理 subprocess CLI

import type { Adapter, ExecutionResult } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

export const julesAdapter: Adapter = {
  id: 'jules',
  name: 'Jules',
  description: 'Google 云端异步编码 Agent。代码上传云端 VM 执行，完成后拉回合并。',
  commands: ['jules'],
  capabilities: [
    { type: 'execute', provider: 'async', description: '云端异步执行，完成后自动拉回' },
    { type: 'inspect', provider: 'sync', description: 'session 状态/日志' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()

    const subMatch = trimmed.match(/^(list|status|pull|log)\s*(.*)$/)
    if (subMatch) {
      const sub = subMatch[1]
      const sid = subMatch[2].trim()
      switch (sub) {
        case 'list': return julesList()
        case 'status': return sessionStatus(sid)
        case 'log': return sessionLog(sid)
        case 'pull': return pullSession(sid)
      }
    }

    if (!trimmed) {
      return { type: 'system', content: '用法: /jules <任务描述>' }
    }

    // 创建新任务
    return createSession(trimmed)
  },

  async status() {
    try {
      const res = await fetch(`${BRIDGE}/jules/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return { available: true, healthy: true, message: 'Jules 云端 Agent 可用' }
    } catch { /* fall through */ }
    return { available: false, healthy: false, message: 'Jules CLI 未安装' }
  },
}

async function createSession(prompt: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/jules/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(30000),
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
      steps: data.steps || [{ id: 's0', title: 'Jules 执行中', status: 'running' }],
      approved: true,
      data: { status: 'running' },
    }
  } catch (e) {
    return { type: 'system', content: `Jules 暂不可用: ${e}` }
  }
}

async function julesList(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/jules/list`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    const sessions = data.sessions || []
    if (sessions.length === 0) return { type: 'system', content: '没有 Jules session' }
    const lines = sessions.map((s: any) =>
      `${(s.sid || '').slice(0, 20)}  ${(s.state || '').padEnd(12)}  ${(s.prompt || '').slice(0, 40)}`
    )
    return { type: 'execution', content: lines.join('\n') }
  } catch (e) {
    return { type: 'system', content: `查询失败: ${e}` }
  }
}

async function sessionStatus(sid: string): Promise<ExecutionResult> {
  if (!sid) return { type: 'system', content: '用法: /jules status <sid>' }
  try {
    const task = await fetchTask(sid)
    if (!task) return { type: 'system', content: `session ${sid} 未找到` }
    const steps = (task.steps || []).map((s: any) =>
      `  [${s.status === 'done' ? '✓' : s.status === 'running' ? '⟳' : '○'}] ${s.title}`
    ).join('\n')
    return { type: 'execution', content: `Jules ${sid}\n状态: ${task.state}\n\n步骤:\n${steps}` }
  } catch (e) {
    return { type: 'system', content: `查询失败: ${e}` }
  }
}

async function sessionLog(sid: string): Promise<ExecutionResult> {
  if (!sid) return { type: 'system', content: '用法: /jules log <sid>' }
  try {
    const task = await fetchTask(sid)
    if (!task) return { type: 'system', content: `session ${sid} 未找到` }
    return { type: 'log', content: (task.log || '').slice(-3000) }
  } catch (e) {
    return { type: 'system', content: `读取日志失败: ${e}` }
  }
}

async function pullSession(sid: string): Promise<ExecutionResult> {
  if (!sid) return { type: 'system', content: '用法: /jules pull <sid>' }
  try {
    const res = await fetch(`${BRIDGE}/jules/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { type: 'execution', content: `已拉回 ${sid} 的代码。\n${(data.output || '').slice(0, 2000)}` }
  } catch (e) {
    return { type: 'system', content: `拉取失败: ${e}` }
  }
}

async function fetchTask(sid: string): Promise<any> {
  try {
    const res = await fetch(`${BRIDGE}/jules/status/${sid}`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return res.json()
  } catch { /* ignore */ }
  return null
}