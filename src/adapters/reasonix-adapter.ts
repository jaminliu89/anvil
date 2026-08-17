// reasonix-adapter — DeepSeek 终端编码 Agent（前缀缓存 + 子agent + MCP + 计划模式）

import { invoke } from '@tauri-apps/api/core'
import type { Adapter, ExecutionResult } from './types'

export const reasonixAdapter: Adapter = {
  id: 'reasonix',
  name: 'Reasonix',
  description: 'DeepSeek 编码 Agent。前缀缓存 + 子智能体 + MCP + 计划模式。',
  commands: ['reasonix', 'rx'],
  capabilities: [
    { type: 'chat', provider: 'streaming', description: '对话（DeepSeek API）' },
    { type: 'plan', provider: 'structured', description: '计划模式：结构化计划 + 审批' },
    { type: 'execute', provider: 'sync', description: '执行已批准的计划' },
    { type: 'mcp', provider: 'sync', description: 'MCP 工具列表与调用' },
    { type: 'inspect', provider: 'sync', description: '缓存命中率 + 子agent 状态' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()
    const subMatch = trimmed.match(/^(plan|exec|status|mcp)\s*([\s\S]*)$/)

    if (subMatch) {
      const sub = subMatch[1]
      const rest = subMatch[2].trim()
      switch (sub) {
        case 'plan': return plan(rest)
        case 'exec': return exec(rest)
        case 'status': return statusInfo()
        case 'mcp': return mcpTools()
      }
    }

    if (!trimmed) {
      return { type: 'system', content: '用法: /reasonix plan|exec|status|mcp，或 /rx <对话>' }
    }

    return chat(trimmed)
  },

  render() { /* TimelineView 内联渲染 */ },

  async status() {
    try {
      await invoke('check_reasonix_installed')
      return { available: true, healthy: true, message: 'Reasonix 已安装' }
    } catch {
      return { available: true, healthy: false, message: 'Reasonix 未检测到' }
    }
  },
}

async function plan(prompt: string): Promise<ExecutionResult> {
  if (!prompt) return { type: 'system', content: '用法: /reasonix plan <任务描述>' }
  try {
    const result = await invoke('run_reasonix_plan', { prompt })
    const parsed = JSON.parse(String(result)) as { steps: string[] }
    return {
      type: 'plan',
      title: prompt.slice(0, 60),
      content: '',
      steps: parsed.steps.map((s: string, i: number) => ({ id: `s${i}`, title: s, status: 'pending' as const })),
    }
  } catch {
    return { type: 'system', content: 'Reasonix 计划需要桌面环境。' }
  }
}

async function exec(step: string): Promise<ExecutionResult> {
  try {
    const result = await invoke('run_reasonix_exec', { step })
    return { type: 'execution', content: String(result).slice(0, 5000) }
  } catch {
    return { type: 'system', content: 'Reasonix 执行需要桌面环境。' }
  }
}

async function statusInfo(): Promise<ExecutionResult> {
  try {
    const s = await invoke('get_reasonix_status') as {
      cacheHitRate: number; subagents: number; sessions: number
    }
    return {
      type: 'execution',
      content: `缓存命中 ${(s.cacheHitRate * 100).toFixed(0)}% · 子agent ${s.subagents} · 会话 ${s.sessions}`,
    }
  } catch {
    return { type: 'system', content: 'Reasonix 状态查询需要桌面环境。' }
  }
}

async function mcpTools(): Promise<ExecutionResult> {
  try {
    const tools = await invoke('list_reasonix_mcp') as { name: string; desc: string }[]
    return { type: 'mcp-result', content: tools.map(t => `${t.name}: ${t.desc}`).join('\n') }
  } catch {
    return { type: 'system', content: 'MCP 工具查询需要桌面环境。' }
  }
}

async function chat(prompt: string): Promise<ExecutionResult> {
  try {
    const res = await fetch('http://127.0.0.1:18443/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
    })
    const json = await res.json()
    return { type: 'message', content: json.message?.content || '(空响应)' }
  } catch {
    return { type: 'system', content: 'Reasonix 对话失败（DSH Bridge 未启动）。' }
  }
}