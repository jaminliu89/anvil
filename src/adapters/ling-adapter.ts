// ling-adapter — default chat adapter via DSH Bridge
// Gracefully degrades when bridge or inference endpoint is down.

import type { Adapter, Message, ChatOpts, ChatResult, ExecutionResult } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

async function bridgeAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

export const lingAdapter: Adapter = {
  id: 'ling',
  name: 'Ling-3.0-tiny',
  description: '本地推理，默认聊天模型。需运行 Ling (:18080) + DSH Bridge (:18443)。',
  commands: [],
  capabilities: [
    { type: 'chat', provider: 'streaming', description: '流式对话 + reasoning 折叠' },
    { type: 'inspect', provider: 'sync', description: '模型状态探活' },
  ],

  async chat(history: Message[], prompt: string, opts?: ChatOpts): Promise<ChatResult> {
    const alive = await bridgeAlive()
    if (!alive) {
      return {
        content: '',
        reasoning: 'DSH Bridge 未启动。先运行 bridge.py --port 18443 和 Ling (:18080)。',
      }
    }

    const messages = [...history, { role: 'user' as const, content: prompt }]
    let content = ''
    let reasoning = ''
    let timedOut = false

    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => { timedOut = true; ctrl.abort() }, 20000)
      const res = await fetch(`${BRIDGE}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: opts?.maxTokens || 2048,
        }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) throw new Error(`bridge ${res.status}`)

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
          let name = '', data = ''
          for (const ln of lines) {
            if (ln.startsWith('event: ')) name = ln.slice(7).trim()
            else if (ln.startsWith('data: ')) data = ln.slice(6)
          }
          if (!name || !data) continue
          try {
            const obj = JSON.parse(data)
            if (name === 'thinking') reasoning += obj.text || ''
            else if (name === 'delta') content += obj.text || ''
            else if (name === 'error') content += `\n\n[error] ${obj.error}`
          } catch { /* skip bad frame */ }
        }
      }
      clearTimeout(timer)
      if (timedOut) {
        content = ''
        reasoning = 'Ling 推理端点未响应（20s 超时）。确认 Ling (:18080) 已启动。'
      }
    } catch (e) {
      if (timedOut) {
        content = ''
        reasoning = 'Ling 推理端点未响应（20s 超时）。确认 Ling (:18080) 已启动。'
      } else {
        // fallback non-streaming
        try {
          const ctrl2 = new AbortController()
          const timer2 = setTimeout(() => ctrl2.abort(), 20000)
          const res = await fetch(`${BRIDGE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messages.map(m => ({ role: m.role, content: m.content })),
            }),
            signal: ctrl2.signal,
          })
          clearTimeout(timer2)
          const json = await res.json()
          content = json.message?.content || '(empty response)'
          reasoning = json.message?.reasoning_content || ''
        } catch (e2) {
          content = ''
          reasoning = '对话失败：DSH Bridge 响应异常。检查 Ling (:18080) 是否运行。'
        }
      }
    }

    return { content, reasoning }
  },

  async execute(_command: string, _args: string): Promise<ExecutionResult> {
    return { type: 'system', content: 'ling-adapter 不支持命令。直接输入文字开始聊天。' }
  },

  async status() {
    try {
      const res = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(2000) })
      const json = await res.json()
      const ok = json.ok === true
      return { available: true, healthy: ok, message: ok ? 'DSH 在线' : 'DSH 异常' }
    } catch {
      return { available: true, healthy: false, message: 'DSH Bridge 未启动。运行 bridge.py --port 18443。' }
    }
  },
}