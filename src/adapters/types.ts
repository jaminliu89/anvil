// Anvil 适配器体系 — 类型定义

export type CapabilityType =
  | 'chat' | 'plan' | 'execute' | 'mcp'
  | 'train' | 'inspect' | 'agent-loop' | 'plugin-system'

export type ProviderType =
  | 'streaming' | 'structured' | 'async' | 'sync'

export interface Capability {
  type: CapabilityType
  provider: ProviderType
  description: string
}

export interface AdapterStatus {
  available: boolean
  healthy: boolean
  message: string
}

// 适配器接口 — 每个工具/平台实现此接口
export interface Adapter {
  id: string
  name: string
  description: string
  commands: string[]
  capabilities: Capability[]

  chat?(history: Message[], prompt: string, opts?: ChatOpts): Promise<ChatResult>
  execute(command: string, args: string): Promise<ExecutionResult>
  render(entry: TimelineEntry, container: HTMLElement): void
  status(): Promise<AdapterStatus>
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
}

export interface ChatOpts {
  maxTokens?: number
  temperature?: number
}

export interface ChatResult {
  content: string
  reasoning?: string
  usage?: { cacheHitRate?: number; totalTokens?: number; elapsedMs?: number }
}

export interface ExecutionResult {
  type: 'chat' | 'plan' | 'execution' | 'approval' | 'diff' | 'pr' | 'log' | 'system' | 'mcp-result'
  title?: string
  content: string
  steps?: { id: string; title: string; status: 'pending' | 'approved' | 'running' | 'done' | 'failed' }[]
  data?: Record<string, unknown>
}

// 时间线条目 — 统一会话流中的一条
export interface TimelineEntry {
  id: string
  timestamp: number
  adapterId: string
  type: 'message' | 'plan' | 'execution' | 'approval' | 'diff' | 'pr' | 'log' | 'system' | 'mcp-result' | 'train'
  data: Record<string, unknown>
}