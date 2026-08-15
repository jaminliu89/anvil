// Anvil sidecar 客户端 — 所有对话经守卫，不直连推理端点

const BASE = 'http://127.0.0.1:18443'

export interface GuardedMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string
}

export interface ChatResult {
  message: GuardedMessage
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cache_hit_rate?: number
  } | null
  finish_reason: string | null
  salvaged: boolean
  elapsed_s: number
}

export interface DoctorCheck {
  name: string
  ok: boolean
  detail: string
}

export interface DoctorResult {
  ok: boolean
  checks: DoctorCheck[]
}

async function post<T>(path: string, body: unknown, timeoutMs = 120000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`sidecar ${res.status}: ${text}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

async function get<T>(path: string, timeoutMs = 30000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`sidecar ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

/** 守卫化对话（非流式） */
export function chat(messages: GuardedMessage[], opts?: { maxTokens?: number; temperature?: number }) {
  return post<ChatResult>('/chat', {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
  })
}

/** 守卫体检 */
export function doctor() {
  return get<DoctorResult>('/doctor')
}

/** 发送前预估 */
export function estimate(prev: GuardedMessage[], messages: GuardedMessage[]) {
  return post<{ cache_hit_rate?: number; estimate?: unknown }>('/estimate', {
    prev: prev.map((m) => ({ role: m.role, content: m.content })),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })
}

/** 流式对话（SSE）。onThinking/onDelta 增量回调 */
export async function streamChat(
  messages: GuardedMessage[],
  handlers: {
    onThinking?: (text: string) => void
    onDelta?: (text: string) => void
    onDone?: () => void
    onError?: (err: string) => void
  },
  opts?: { maxTokens?: number; temperature?: number },
) {
  const res = await fetch(`${BASE}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  })
  if (!res.ok || !res.body) {
    handlers.onError?.(`sidecar ${res.status}`)
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
        if (name === 'thinking') handlers.onThinking?.(obj.text || '')
        else if (name === 'delta') handlers.onDelta?.(obj.text || '')
        else if (name === 'done') handlers.onDone?.()
        else if (name === 'error') handlers.onError?.(obj.error || 'unknown')
      } catch {
        /* 忽略坏帧 */
      }
    }
  }
  handlers.onDone?.()
}

/** 守卫服务是否在线 */
export async function sidecarAlive(): Promise<boolean> {
  try {
    await get('/health', 3000)
    return true
  } catch {
    return false
  }
}
