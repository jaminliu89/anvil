// Command parser — determines if input is chat or command
// Built-in: /switch, /help
// Adapter commands: /dock, /codex, /pi, /reasonix, /dsh, /train

import { findByCommand, commandMap } from './registry'
import type { Adapter } from './types'

export interface ParsedChat {
  type: 'chat'
  text: string
}

export interface ParsedCommand {
  type: 'command'
  adapter: Adapter
  command: string
  args: string
}

export interface ParsedBuiltin {
  type: 'builtin'
  command: string
  args: string
}

export interface ParsedError {
  type: 'error'
  message: string
}

export type Parsed = ParsedChat | ParsedCommand | ParsedBuiltin | ParsedError

export function parse(input: string): Parsed {
  const trimmed = input.trim()
  if (!trimmed) return { type: 'chat', text: '' }

  const match = trimmed.match(/^\/(\w+)\s*(.*)/)
  if (!match) {
    return { type: 'chat', text: trimmed }
  }

  const cmdName = match[1].toLowerCase()
  const args = match[2].trim()

  // Built-in commands
  if (cmdName === 'switch' || cmdName === 'help') {
    return { type: 'builtin', command: cmdName, args }
  }

  const adapter = findByCommand(cmdName)
  if (!adapter) {
    return { type: 'error', message: `未知命令: /${cmdName}。输入 /help 查看全部。` }
  }

  return { type: 'command', adapter, command: cmdName, args }
}

export function suggest(input: string): string[] {
  if (!input.startsWith('/')) return []
  const partial = input.slice(1).toLowerCase()
  const all: string[] = []

  for (const cmd of commandMap.keys()) {
    if (cmd.startsWith(partial) && !all.includes('/' + cmd)) {
      all.push('/' + cmd)
    }
  }

  // built-in
  if ('switch'.startsWith(partial) && !all.includes('/switch')) all.push('/switch')
  if ('help'.startsWith(partial) && !all.includes('/help')) all.push('/help')

  return all.sort()
}