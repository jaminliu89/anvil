// jules-adapter — Google Jules 云端异步编码 Agent
// 走 jules CLI 通过 bridge sidecar 代理调用
// 云端异步，不占本地资源

import type { Adapter, ExecutionResult } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

export const julesAdapter: Adapter = {
  id: 'jules',
  name: 'Jules',
  description: 'Google 云端异步编码 Agent。云端执行，不占本地资源。',
  commands: ['jules'],
  capabilities: [
    { type: 'plan', provider: 'structured', description: '生成编码计划，批准后执行' },
    { type: 'execute', provider: 'async', description: '云端后台执行，结果返回时间线' },
    { type: 'inspect', provider: 'sync', description: 'session 状态/日志' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()

    // 子命令
    const subMatch = trimmed.match(/^(status|log|approve|pr)\s*(.*)$/)
    if (subMatch) {
      const sub = subMatch[1]
      // const rest = subMatch[2].trim()  // 保留供后续扩展
      switch (sub) {
        case 'status':
          return { type: 'system', content: 'Jules 状态查询（需 bridge 代理）' }
        case 'log':
          return { type: 'system', content: 'Jules 日志（需 bridge 代理）' }
        case 'approve':
          return { type: 'system', content: 'Jules 批准（需 bridge 代理）' }
        case 'pr':
          return { type: 'system', content: 'Jules PR（需 bridge 代理）' }
      }
    }

    if (!trimmed) {
      return { type: 'system', content: '用法: /jules <任务描述>' }
    }

    // 创建 session — 走 bridge 代理
    try {
      const res = await fetch(`${BRIDGE}/jules/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return {
        type: 'plan',
        title: trimmed.slice(0, 60),
        content: trimmed,
        sessionId: data.sid,
        steps: [{ id: 's0', title: '已派单到云端', status: 'running' as const }],
      }
    } catch (e) {
      return {
        type: 'system',
        content: `Jules 暂不可用: ${e}`,
      }
    }
  },

  async status() {
    try {
      const res = await fetch(`${BRIDGE}/jules/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        return { available: true, healthy: true, message: 'Jules 云端 Agent 可用' }
      }
    } catch { /* fall through */ }
    return { available: false, healthy: false, message: 'Jules 未连接' }
  },
}
