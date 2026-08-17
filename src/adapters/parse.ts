// 命令解析器 — 判断输入是聊天还是命令

import { findByCommand, commandMap } from './registry'
import type { Adapter } from './types'

export interface ParsedChat {
  type: 'chat'
  text: string
}

export interface ParsedCommand {
  type: 'command'
  adapter: Adapter
  command: string    // e.g. 'dock'
  args: string       // e.g. '修复 login 500'
}

export interface ParsedError {
  type: 'error'
  message: string
}

export type Parsed = ParsedChat | ParsedCommand | ParsedError

// /dock 修复 login 500  → command: dock, args: 修复 login 500
// /dsh start            → command: dsh, args: start
// 普通的文字             → chat
export function parse(input: string): Parsed {
  const trimmed = input.trim()
  if (!trimmed) return { type: 'chat', text: '' }

  const match = trimmed.match(/^\/(\w+)\s*(.*)/)
  if (!match) {
    return { type: 'chat', text: trimmed }
  }

  const cmdName = match[1].toLowerCase()
  const args = match[2].trim()
  const adapter = findByCommand(cmdName)
  if (!adapter) {
    return { type: 'error', message: `未知命令: /${cmdName}。输入 /help 查看所有可用命令。` }
  }

  return { type: 'command', adapter, command: cmdName, args }
}

export function suggest(input: string): string[] {
  if (!input.startsWith('/')) return []

  const partial = input.slice(1).toLowerCase()
  const matches: string[] = []

  for (const cmd of commandMap.keys()) {
    if (cmd.startsWith(partial) && !matches.includes(`/${cmd}`)) {
      matches.push(`/${cmd}`)
    }
  }

  return matches.sort()
}