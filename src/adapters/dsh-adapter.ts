// dsh-adapter — DeepSeek Harness agent loop 集成
// 走 bridge HTTP API，SSE 流式输出 agent loop 过程
// v2: 多轮 action plan + reasoning 流式 + fetch 工具

import type { Adapter, ExecutionResult, ChatResult, Message, ChatOpts } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

export interface AgentLoopStep {
  id: string
  title: string
  status: 'pending' | 'running' | 'done' | 'failed'
  content?: string
  result?: unknown
}

export interface AgentLoopCallbacks {
  onStepStart?: (step: AgentLoopStep) => void
  onStepUpdate?: (stepId: string, content: string) => void
  onStepReasoning?: (stepId: string, content: string) => void  // 新增：推理增量
  onStepDone?: (stepId: string, status: 'done' | 'failed', result?: unknown) => void
  onFinal?: (content: string, meta: { steps: number; usedSearch: boolean; reasoning?: string }) => void
  onError?: (message: string) => void
}

export const dshAdapter: Adapter = {
  id: 'dsh',
  name: 'DeepSeek Harness',
  description: 'Agent 框架平台。agent loop + 联网搜索 + 多步骤执行。',
  commands: ['dsh'],
  capabilities: [
    { type: 'chat', provider: 'sync', description: '普通聊天（守卫化对话）' },
    { type: 'agent-loop', provider: 'async', description: '多步骤 agent loop，自动决定是否联网搜索' },
    { type: 'inspect', provider: 'sync', description: '服务状态检查' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()
    const sub = trimmed.split(/\s+/)[0]
    const rest = trimmed.slice(sub.length).trim()

    switch (sub) {
      case 'start':
        return { type: 'system', content: 'DSH agent loop 已就绪。直接输入 /dsh <任务> 开始。' }
      case 'stop':
        return { type: 'system', content: '正在运行的 agent loop 会在当前步骤结束后停止。' }
      case 'status':
        return statusDsh()
      case 'run':
        return { type: 'agent-loop', title: 'Agent Loop', content: rest || '' }
      case '':
        return { type: 'system', content: '用法: /dsh <任务描述>\n\n示例:\n  /dsh 分析一下最近的 AI 新闻\n  /dsh 帮我查一下 Vite 5 的新特性' }
      default:
        return { type: 'agent-loop', title: 'Agent Loop', content: trimmed }
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

  // 普通聊天（守卫化对话，带搜索增强）
  async chat(history: Message[], text: string, opts?: ChatOpts & { search?: boolean }): Promise<ChatResult> {
    const messages = history.slice(-20).map(m => ({ role: m.role, content: m.content }))
    messages.push({ role: 'user', content: text })
    
    try {
      const res = await fetch(`${BRIDGE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          search: opts?.search !== false,
          max_tokens: opts?.maxTokens,
          temperature: opts?.temperature,
        }),
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`对话失败 (${res.status}): ${errText.slice(0, 200)}`)
      }
      const data = await res.json()
      return {
        content: data.message?.content || data.content || '',
        reasoning: data.message?.reasoning_content || data.reasoning || '',
        usage: {
          totalTokens: data.usage?.total_tokens,
          cacheHitRate: data.usage?.cache_hit_rate,
          elapsedMs: data.elapsed_s ? data.elapsed_s * 1000 : undefined,
        },
      }
    } catch (e) {
      return {
        content: `抱歉，暂时无法回复：${(e as Error).message}`,
        reasoning: '',
      }
    }
  },
}

/**
 * 流式运行 agent loop（v2: 支持 reasoning 流式）
 */
export async function runAgentLoopStream(
  prompt: string,
  callbacks: AgentLoopCallbacks,
  opts?: { search?: boolean; signal?: AbortSignal },
): Promise<void> {
  if (!prompt) {
    callbacks.onError?.('prompt 不能为空')
    return
  }

  try {
    const res = await fetch(`${BRIDGE}/dsh/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        search: opts?.search !== false,
      }),
      signal: opts?.signal,
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      callbacks.onError?.(`agent loop 启动失败 (${res.status}): ${text.slice(0, 200)}`)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      const events = buf.split('\n\n')
      buf = events.pop() || ''

      for (const evt of events) {
        const lines = evt.split('\n')
        let name = ''
        let data = ''
        for (const ln of lines) {
          if (ln.startsWith('event: ')) name = ln.slice(7).trim()
          else if (ln.startsWith('data: ')) data = ln.slice(6)
        }
        if (!name || !data) continue

        try {
          const obj = JSON.parse(data)

          switch (name) {
            case 'step_start':
              callbacks.onStepStart?.({
                id: obj.id,
                title: obj.title,
                status: obj.status || 'running',
              })
              break
            case 'step_update':
              callbacks.onStepUpdate?.(obj.id, obj.content || '')
              break
            case 'step_reasoning':  // 新增：推理增量事件
              callbacks.onStepReasoning?.(obj.id, obj.content || '')
              break
            case 'step_done':
              callbacks.onStepDone?.(obj.id, obj.status || 'done', obj.result)
              break
            case 'final':
              callbacks.onFinal?.(obj.content || '', {
                steps: obj.steps || 0,
                usedSearch: !!obj.used_search,
                reasoning: obj.reasoning || '',
              })
              break
            case 'error':
              callbacks.onError?.(obj.message || 'unknown error')
              break
          }
        } catch {
          // 忽略坏帧
        }
      }
    }
  } catch (e: unknown) {
    if ((e as Error).name === 'AbortError') {
      callbacks.onError?.('已取消')
    } else {
      callbacks.onError?.(String((e as Error)?.message || e))
    }
  }
}

async function statusDsh(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/dsh/health`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) throw new Error()
    const json = await res.json()
    return {
      type: 'system',
      content: `DSH agent loop 就绪 · 守卫库: ${json.dsh || 'unknown'}`,
    }
  } catch {
    return { type: 'system', content: 'bridge 未启动。DSH agent loop 需要 bridge 运行。' }
  }
}