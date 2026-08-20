// ollama-adapter — Ollama 本地模型聊天
// 直接调用 Ollama REST API (:11434)
// 作为离线/低资源场景的聊天兜底

import type { Adapter, ChatResult, Message, ChatOpts, ExecutionResult } from './types'

const OLLAMA_BASE = 'http://127.0.0.1:11434'

export const ollamaAdapter: Adapter = {
  id: 'ollama',
  name: 'Ollama',
  description: '本地模型聊天。离线可用，不消耗 token。',
  commands: ['ollama'],
  capabilities: [
    { type: 'chat', provider: 'streaming', description: '本地模型流式聊天' },
    { type: 'inspect', provider: 'sync', description: '本地模型列表/状态' },
  ],

  async chat(history: Message[], prompt: string, opts?: ChatOpts): Promise<ChatResult> {
    const messages = [...history, { role: 'user' as const, content: prompt }]

    try {
      // 先拿模型列表，选第一个可用的
      let model = localStorage.getItem('anvil-ollama-model') || ''
      if (!model) {
        model = await getFirstModel()
      }

      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          ...(opts?.maxTokens ? { options: { num_predict: opts.maxTokens } } : {}),
          ...(opts?.temperature !== undefined ? { options: { temperature: opts.temperature } } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      })

      if (!res.ok) {
        throw new Error(`Ollama HTTP ${res.status}`)
      }

      const data = await res.json()
      return {
        content: data.message?.content || '',
        reasoning: '',
        usage: {
          totalTokens: data.eval_count + data.prompt_eval_count || 0,
        },
      }
    } catch (e) {
      return { content: `Ollama 调用失败: ${e}`, reasoning: '' }
    }
  },

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()
    if (trimmed === 'models' || trimmed === 'list') {
      const models = await listModels()
      return {
        type: 'system',
        content: `本地模型:\n${models.map((m: { name: string; size?: string }) => `  ${m.name}`).join('\n')}`,
      }
    }
    if (trimmed.startsWith('use ')) {
      const model = trimmed.slice(4).trim()
      localStorage.setItem('anvil-ollama-model', model)
      return { type: 'system', content: `已切换到 ${model}` }
    }
    return { type: 'system', content: 'Ollama 用法: /ollama models（列模型）、/ollama use <name>（切换模型）' }
  },

  async status() {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const data = await res.json()
        const count = data.models?.length || 0
        return { available: true, healthy: true, message: `Ollama 运行中，${count} 个模型` }
      }
    } catch { /* fall through */ }
    return { available: false, healthy: false, message: 'Ollama 未启动 (:11434)' }
  },
}

async function getFirstModel(): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    if (data.models?.length > 0) {
      return data.models[0].name
    }
  } catch { /* fall through */ }
  return 'llama3' // 默认值，实际不可用时会报错
}

async function listModels(): Promise<{ name: string; size?: string }[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    return data.models || []
  } catch {
    return []
  }
}
