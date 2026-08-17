// dsh-adapter — DeepSeek Harness 集成（三层：生命周期 / 插件 / 任务路由）

import { invoke } from '@tauri-apps/api/core'
import type { Adapter, ExecutionResult } from './types'

const DSH_PORT = 3000

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
      case 'start': return startDsh()
      case 'stop': return stopDsh()
      case 'status': return statusDsh()
      case 'plugins': return listPlugins()
      case 'run': return runAgentLoop(rest)
      case '': return { type: 'system', content: '用法: /dsh start|stop|status|plugins|run <prompt>' }
      default: return runAgentLoop(trimmed)
    }
  },

  render() { /* TimelineView 内联渲染 */ },

  async status() {
    try {
      const res = await fetch(`http://127.0.0.1:${DSH_PORT}/health`, { signal: AbortSignal.timeout(2000) })
      return { available: true, healthy: res.ok, message: 'dsh 运行中' }
    } catch {
      return { available: true, healthy: false, message: 'dsh 未启动（/dsh start）' }
    }
  },
}

async function startDsh(): Promise<ExecutionResult> {
  try {
    await invoke('start_dsh')
    return { type: 'system', content: `dsh 启动中，Web UI: http://localhost:${DSH_PORT}` }
  } catch {
    return { type: 'system', content: '启动失败：需要 Node.js + npx @deepseek-ai/dsh。' }
  }
}

async function stopDsh(): Promise<ExecutionResult> {
  try {
    await invoke('stop_dsh')
    return { type: 'system', content: 'dsh 已停止。' }
  } catch {
    return { type: 'system', content: '停止失败。' }
  }
}

async function statusDsh(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`http://127.0.0.1:${DSH_PORT}/health`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) return { type: 'system', content: `dsh 运行中 · http://localhost:${DSH_PORT}` }
    throw new Error()
  } catch {
    return { type: 'system', content: 'dsh 未运行。/dsh start 启动。' }
  }
}

async function listPlugins(): Promise<ExecutionResult> {
  return { type: 'system', content: 'dsh 插件桥接（v2.3）：插件列表 + 自动注册为 Anvil 适配器。' }
}

async function runAgentLoop(prompt: string): Promise<ExecutionResult> {
  if (!prompt) return { type: 'system', content: '用法: /dsh run <任务描述>' }
  try {
    const result = await invoke('run_dsh_agent', { prompt })
    return { type: 'execution', content: `dsh agent loop 结果:\n${String(result).slice(0, 5000)}` }
  } catch {
    return { type: 'system', content: 'dsh agent loop 需要桌面环境 + dsh 服务运行。先 /dsh start。' }
  }
}