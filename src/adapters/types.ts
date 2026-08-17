// Anvil adapter types — Parchment 4.0

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

export type ExecutionEntryType =
  | 'message' | 'system' | 'plan' | 'execution' | 'approval'
  | 'diff' | 'pr' | 'log' | 'mcp-result' | 'train'

export interface ExecutionResult {
  type: ExecutionEntryType
  title?: string
  content: string
  steps?: { id: string; title: string; status: 'pending' | 'approved' | 'running' | 'done' | 'failed' }[]
  sessionId?: string
  branch?: string
  approved?: boolean
  data?: Record<string, unknown>
}

export interface Adapter {
  id: string
  name: string
  description: string
  commands: string[]
  capabilities: Capability[]

  chat?(history: Message[], prompt: string, opts?: ChatOpts): Promise<ChatResult>
  execute(command: string, args: string): Promise<ExecutionResult>
  render?(entry: TimelineEntry, container: HTMLElement): void
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

export interface TimelineEntry {
  id: string
  timestamp: number
  adapterId: string
  type: ExecutionEntryType
  data: Record<string, unknown>
}