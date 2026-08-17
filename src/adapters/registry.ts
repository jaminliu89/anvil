// 适配器注册表 — 管理所有适配器，自动建立命令→适配器映射

import type { Adapter, AdapterStatus } from './types'

const adapters = new Map<string, Adapter>()
const commandMap = new Map<string, Adapter>()  // /dock → dockAdapter

export function register(adapter: Adapter) {
  if (adapters.has(adapter.id)) {
    console.warn(`[adapter] duplicate register: ${adapter.id}, skipping`)
    return
  }
  adapters.set(adapter.id, adapter)
  for (const cmd of adapter.commands) {
    // /d and /dock both map to same adapter
    commandMap.set(cmd, adapter)
    commandMap.set(cmd.toLowerCase(), adapter)
  }
  console.log(`[adapter] registered: ${adapter.id} (commands: /${adapter.commands.join(', /')})`)
}

export function get(id: string): Adapter | undefined {
  return adapters.get(id)
}

export function findByCommand(cmd: string): Adapter | undefined {
  return commandMap.get(cmd) || commandMap.get(cmd.toLowerCase())
}

export function all(): Adapter[] {
  return Array.from(adapters.values())
}

export function allStatuses(): Promise<AdapterStatus[]> {
  return Promise.all(
    Array.from(adapters.values()).map(a => a.status().catch(() => ({
      available: false,
      healthy: false,
      message: 'failed to probe',
    })))
  )
}

export function listCommands(): { command: string; adapterName: string; description: string }[] {
  const result: { command: string; adapterName: string; description: string }[] = []
  const seen = new Set<string>()
  for (const [cmd, adapter] of commandMap) {
    const key = `${adapter.id}:${cmd}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ command: `/${cmd}`, adapterName: adapter.name, description: adapter.description })
  }
  return result.sort((a, b) => a.command.localeCompare(b.command))
}

export { adapters, commandMap }