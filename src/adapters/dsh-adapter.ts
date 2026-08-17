// dsh-adapter — DeepSeek Harness 集成（三层：生命周期 / 插件 / 任务路由）
// 走 bridge HTTP API，不依赖 Tauri invoke

import type { Adapter, ExecutionResult } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

function statusMsg(msg: string): ExecutionResult {
  return { type: 'system', content: msg }
}

export const dshAdapter: Adapter = {
  id: 'dsh',
  name: 'DeepSeek Harness',
  description: 'Agent 框架平台。插件生态 + agent loop + 任务路由。',
  commands: ['dsh'],
  capabilities: [
    { type: 'agent-loop', provider: 'async', description: '复杂任务路由给 dsh agent loop' },
    { type: 'plugin-system', provider: 'sync', description: 'dsh 插件发现与注册' },
    { type: 'inspect', provider: 'sync', description: '服务生命周期管理' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()
    const sub = trimmed.split(/\s+/)[0]
    const rest = trimmed.slice(sub.length).trim()

    switch (sub) {
      case 'start':    return startDsh()
      case 'stop':     return stopDsh()
      case 'status':   return statusDsh()
      case 'plugins':  return listPlugins()
      case 'sessions': return listSessions()
      case 'run':      return runAgentLoop(rest)
      case '':         return statusMsg('用法: /dsh start|stop|status|plugins|sessions|run <prompt>')
      default:         return runAgentLoop(trimmed)
    }
  },

  async status() {
    try {
      const res = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(2000) })
      return { available: true, healthy: res.ok, message: 'bridge 运行中' }
    } catch {
      return { available: true, healthy: false, message: 'bridge 未启动（python3 bridge.py --port 18443）' }
    }
  },
}

async function startDsh(): Promise<ExecutionResult> {
  return statusMsg('运行 npx @deepseek-ai/dsh 启动 dsh，或确认 bridge 已配置自动启动。')
}

async function stopDsh(): Promise<ExecutionResult> {
  return statusMsg('手动停止 dsh 进程：pkill -f dsh 或关闭启动它的终端。')
}

async function statusDsh(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/dsh/health`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) throw new Error()
    const json = await res.json()
    return statusMsg(`dsh 运行中 · Web UI: http://localhost:3000 · 插件: ${json.plugins || 0}`)
  } catch {
    return statusMsg('dsh 未运行。通过 bridge 启动或 /dsh start。')
  }
}

async function listPlugins(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/dsh/plugins`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error()
    const json = await res.json()
    const plugins = json.plugins || []
    if (plugins.length === 0) return statusMsg('dsh 运行中但无插件加载。')
    const lines = plugins.map((p: { name: string }) => `  ${p.name}`).join('\n')
    return statusMsg(`dsh 已加载插件:\n${lines}`)
  } catch {
    return statusMsg('无法获取插件列表。确认 bridge 运行 + dsh 已通过 bridge 初始化。')
  }
}

async function listSessions(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/dsh/sessions`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error()
    const json = await res.json()
    const sessions = json.sessions || []
    if (sessions.length === 0) return statusMsg('无活跃 dsh 会话。')
    const lines = sessions.map((s: { id: string }) => `  ${s.id}`).join('\n')
    return statusMsg(`dsh 活跃会话:\n${lines}`)
  } catch {
    return statusMsg('无法获取会话列表。')
  }
}

async function runAgentLoop(prompt: string): Promise<ExecutionResult> {
  if (!prompt) return statusMsg('用法: /dsh run <任务描述>')
  try {
    const res = await fetch(`${BRIDGE}/dsh/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error()
    const json = await res.json()
    const result = json.result || '(空)'
    return { type: 'execution', content: `dsh agent loop 结果:\n${String(result).slice(0, 5000)}` }
  } catch {
    return statusMsg('dsh agent loop 失败。确认 dsh 运行中。')
  }
}