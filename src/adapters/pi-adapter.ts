// pi-adapter — Pi RPC 模式编码 Agent
// 通过 Tauri 启动 pi --mode rpc，stdin/stdout JSONL 协议通信
// 事件通过 pi-event 推送到前端

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Adapter, ExecutionResult, ChatResult, Message, ChatOpts } from './types'

// 全局状态：Pi 是否已启动
let piStarted = false
let startPromise: Promise<void> | null = null

// 当前正在进行的 chat 请求状态
interface ActiveChat {
  resolve: (result: ChatResult) => void
  reject: (error: Error) => void
  content: string
  reasoning: string
  totalTokens?: number
  startTime: number
}

let activeChat: ActiveChat | null = null

/**
 * 确保 Pi 进程已启动
 */
async function ensurePiStarted(): Promise<void> {
  if (piStarted) return
  if (startPromise) return startPromise

  startPromise = (async () => {
    try {
      await invoke('pi_start')
      piStarted = true

      // 监听事件
      await listen('pi-event', (event) => {
        handlePiEvent(event.payload as string)
      })
    } catch (e) {
      piStarted = false
      startPromise = null
      throw e
    }
  })()

  return startPromise
}

/**
 * 处理 Pi 事件（JSONL 解析）
 */
function handlePiEvent(raw: string) {
  try {
    const evt = JSON.parse(raw)
    const type = evt.type

    if (!activeChat) return

    switch (type) {
      case 'message_update': {
        // 流式文本增量
        const delta = evt.assistantMessageEvent?.delta || ''
        if (delta && typeof delta === 'string') {
          activeChat.content += delta
        }
        // 推理增量
        if (evt.assistantMessageEvent?.type === 'thinking_delta') {
          activeChat.reasoning += evt.assistantMessageEvent.delta || ''
        }
        // 调用方可以通过自定义事件订阅流式更新
        // （这里先全量返回，流式 UI 后面优化）
        break
      }
      case 'message_end': {
        activeChat.totalTokens = evt.usage?.totalTokens
        const result: ChatResult = {
          content: activeChat.content,
          reasoning: activeChat.reasoning,
          usage: {
            totalTokens: activeChat.totalTokens,
            elapsedMs: Date.now() - activeChat.startTime,
          },
        }
        const resolve = activeChat.resolve
        activeChat = null
        resolve(result)
        break
      }
      case 'agent_end': {
        // agent 结束（可能是 message_end 之前或之后）
        // 如果 message_end 已经触发过，这里忽略
        if (activeChat) {
          // 还没收到 message_end，用当前积累的内容结束
          const result: ChatResult = {
            content: activeChat.content,
            reasoning: activeChat.reasoning,
            usage: {
              elapsedMs: Date.now() - activeChat.startTime,
            },
          }
          const resolve = activeChat.resolve
          activeChat = null
          resolve(result)
        }
        break
      }
      case 'error': {
        if (activeChat) {
          const reject = activeChat.reject
          activeChat = null
          reject(new Error(evt.message || 'Pi 未知错误'))
        }
        break
      }
    }
  } catch (e) {
    console.warn('pi event parse error:', e, raw)
  }
}

/**
 * Pi 聊天（独立函数，供内部各处调用）
 */
async function piChat(history: Message[], prompt: string): Promise<ChatResult> {
  await ensurePiStarted()

  // 构造带历史的 prompt
  let fullPrompt = ''
  if (history.length > 0) {
    fullPrompt += '【对话历史】\n'
    for (const msg of history.slice(-10)) {
      const role = msg.role === 'user' ? '用户' : '助手'
      fullPrompt += `${role}: ${msg.content}\n`
    }
    fullPrompt += '\n【当前请求】\n'
  }
  fullPrompt += prompt

  return new Promise<ChatResult>((resolve, reject) => {
    activeChat = {
      resolve,
      reject,
      content: '',
      reasoning: '',
      startTime: Date.now(),
    }

    invoke('pi_send_prompt', { message: fullPrompt }).catch((e) => {
      if (activeChat) {
        activeChat = null
      }
      reject(e)
    })

    // 超时保护（10 分钟）
    setTimeout(() => {
      if (activeChat) {
        const rejectFn = activeChat.reject
        activeChat = null
        rejectFn(new Error('Pi 响应超时'))
      }
    }, 10 * 60 * 1000)
  })
}

export const piAdapter: Adapter = {
  id: 'pi',
  name: 'Pi',
  description: '轻量级终端编码 Agent。RPC 模式，流式输出。',
  commands: ['pi'],
  capabilities: [
    { type: 'chat', provider: 'streaming', description: '流式聊天编码' },
    { type: 'execute', provider: 'sync', description: '非交互批量执行' },
  ],

  async chat(history: Message[], prompt: string, _opts?: ChatOpts): Promise<ChatResult> {
    return piChat(history, prompt)
  },

  /**
   * execute 接口（向后兼容：旧的 /pi 命令）
   */
  async execute(_command: string, args: string): Promise<ExecutionResult> {
    if (!args) {
      return { type: 'system', content: '用法: /pi <编码任务描述>' }
    }

    try {
      const result = await piChat([], args)
      return {
        type: 'execution',
        content: result.content.slice(0, 5000),
      }
    } catch (e) {
      return {
        type: 'system',
        content: `Pi 执行失败: ${(e as Error).message}`,
      }
    }
  },

  render() { /* TimelineView 内联渲染 */ },

  async status() {
    try {
      const state = await invoke<{ status: string; message?: string }>('pi_status')
      const healthy = state.status === 'running' || state.status === 'idle'
      const installed = await invoke<boolean>('pi_check_installed')
      if (!installed) {
        return { available: false, healthy: false, message: 'pi 未安装' }
      }
      return {
        available: installed,
        healthy,
        message: state.message || (healthy ? 'pi 就绪' : 'pi 未启动（按需启动）'),
      }
    } catch {
      return { available: false, healthy: false, message: 'pi 状态未知' }
    }
  },
}
