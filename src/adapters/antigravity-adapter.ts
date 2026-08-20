// antigravity-adapter — Google Antigravity (agy) 本地实时配对编程助手
// 直连系统权限，执行终端命令/读写文件/开浏览器
// 通过 bridge sidecar 代理 subprocess 调用

import type { Adapter, ExecutionResult } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

export const antigravityAdapter: Adapter = {
  id: 'antigravity',
  name: 'Antigravity',
  description: 'Google 本地实时配对编程 Agent。直连系统权限，改代码/跑命令/开浏览器。',
  commands: ['agy', 'antigravity'],
  capabilities: [
    { type: 'execute', provider: 'async', description: '本地实时执行，结果直接返回' },
    { type: 'inspect', provider: 'sync', description: '状态/日志' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()

    const subMatch = trimmed.match(/^(status|log)\s+(.*)$/)
    if (subMatch) {
      const sub = subMatch[1]
      const sid = subMatch[2].trim()
      if (sub === 'status') return sessionStatus(sid)
      if (sub === 'log') return sessionLog(sid)
    }

    if (!trimmed) {
      return { type: 'system', content: '用法: /antigravity <任务描述>' }
    }

    return createTask(trimmed)
  },

  async status() {
    try {
      const res = await fetch(`${BRIDGE}/antigravity/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return { available: true, healthy: true, message: 'Antigravity 本地 Agent 可用' }
    } catch { /* fall through */ }
    return { available: false, healthy: false, message: 'Antigravity (agy) CLI 未安装' }
  },
}

async function createTask(prompt: string): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/antigravity/create`, {
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
      steps: data.steps || [{ id: 's0', title: 'Antigravity 执行中', status: 'running' }],
      approved: true,
      data: { status: 'running' },
    }
  } catch (e) {
    return { type: 'system', content: `Antigravity 暂不可用: ${e}` }
  }
}

async function sessionStatus(sid: string): Promise<ExecutionResult> {
  if (!sid) return { type: 'system', content: '用法: /antigravity status <sid>' }
  try {
    const task = await fetchTask(sid)
    if (!task) return { type: 'system', content: `session ${sid} 未找到` }
    const steps = (task.steps || []).map((s: any) =>
      `  [${s.status === 'done' ? '✓' : s.status === 'running' ? '⟳' : '○'}] ${s.title}`
    ).join('\n')
    return { type: 'execution', content: `Antigravity ${sid}\n状态: ${task.state}\n\n步骤:\n${steps}` }
  } catch (e) {
    return { type: 'system', content: `查询失败: ${e}` }
  }
}

async function sessionLog(sid: string): Promise<ExecutionResult> {
  if (!sid) return { type: 'system', content: '用法: /antigravity log <sid>' }
  try {
    const task = await fetchTask(sid)
    if (!task) return { type: 'system', content: `session ${sid} 未找到` }
    return { type: 'log', content: (task.log || '').slice(-3000) }
  } catch (e) {
    return { type: 'system', content: `读取日志失败: ${e}` }
  }
}

async function fetchTask(sid: string): Promise<any> {
  try {
    const res = await fetch(`${BRIDGE}/antigravity/status/${sid}`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return res.json()
  } catch { /* ignore */ }
  return null
}