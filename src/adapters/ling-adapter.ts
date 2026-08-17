// ling-adapter — 默认聊天适配器，走 DSH Bridge

import { chat, streamChat } from '@/services/dsh'
import type { Adapter, Message, ChatOpts, ChatResult, ExecutionResult } from './types'

export const lingAdapter: Adapter = {
  id: 'ling',
  name: 'Ling-3.0-tiny',
  description: '本地推理，默认聊天模型。支持 Ling / DeepSeek API / Unsloth 切换。',
  commands: [],  // 默认适配器，无命令前缀
  capabilities: [
    { type: 'chat', provider: 'streaming', description: '流式对话 + reasoning 折叠' },
    { type: 'inspect', provider: 'sync', description: '模型状态探活' },
  ],

  async chat(history: Message[], prompt: string, opts?: ChatOpts): Promise<ChatResult> {
    const messages = [...history, { role: 'user' as const, content: prompt }]
    let content = ''
    let reasoning = ''

    try {
      await streamChat(
        messages.map(m => ({ role: m.role, content: m.content })),
        {
          onThinking: (t: string) => { reasoning += t },
          onDelta: (t: string) => { content += t },
          onError: (err: string) => { content += `\n\n[error] ${err}` },
        },
        { maxTokens: opts?.maxTokens || 2048 },
      )
    } catch {
      // fallback non-streaming
      try {
        const r = await chat(messages.map(m => ({ role: m.role, content: m.content })), { maxTokens: 2048 })
        content = r.message.content
        reasoning = r.message.reasoning_content || ''
      } catch (e2) {
        content = `[error] ${e2}`
      }
    }

    return { content, reasoning }
  },

  async execute(_command: string, _args: string): Promise<ExecutionResult> {
    return { type: 'system', content: 'ling-adapter 不支持命令执行。直接输入文字开始聊天。' }
  },

  async status() {
    try {
      const res = await fetch('http://127.0.0.1:18443/health')
      const json = await res.json()
      return { available: true, healthy: json.ok === true, message: json.ok ? 'DSH 在线' : 'DSH 异常' }
    } catch {
      return { available: false, healthy: false, message: 'DSH Bridge 未启动' }
    }
  },
}