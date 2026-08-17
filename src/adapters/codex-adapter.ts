// codex-adapter — 沙箱执行 + 配额管理

import { invoke } from '@tauri-apps/api/core'
import type { Adapter, ExecutionResult } from './types'

export const codexAdapter: Adapter = {
  id: 'codex',
  name: 'codex',
  description: '沙箱编码执行 + 配额查询。',
  commands: ['codex', 'cx'],
  capabilities: [
    { type: 'execute', provider: 'sync', description: 'codex exec 非交互执行' },
    { type: 'inspect', provider: 'sync', description: '配额使用情况' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()

    if (trimmed === 'quota' || trimmed.startsWith('quota')) {
      return quota()
    }

    if (!trimmed) {
      return { type: 'system', content: '用法: /codex <任务> 或 /codex quota' }
    }

    try {
      const result = await invoke('run_codex', { prompt: trimmed })
      return { type: 'execution', content: String(result).slice(0, 5000) }
    } catch {
      return { type: 'system', content: 'codex 执行需要桌面环境（Tauri shell 权限）。' }
    }
  },

  render() { /* TimelineView 内联渲染 */ },

  async status() {
    return { available: true, healthy: true, message: 'codex CLI' }
  },
}

async function quota(): Promise<ExecutionResult> {
  try {
    const q = await invoke('get_codex_quota') as { used: number; total: number; reset: string }
    return { type: 'execution', content: `codex 配额: ${q.used}/${q.total}，重置: ${q.reset}` }
  } catch {
    return { type: 'execution', content: 'codex quota 查询失败（需要桌面环境）。' }
  }
}