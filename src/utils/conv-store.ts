// 会话持久化 — localStorage 存对话历史 + 多会话管理
import type { TimelineEntry } from '@/adapters/types'

const KEY_PREFIX = 'anvil.conv.'
const INDEX_KEY = 'anvil.convs'

export interface ConvMeta {
  id: string
  title: string
  updatedAt: number
}

function readIndex(): ConvMeta[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]')
  } catch {
    return []
  }
}

function writeIndex(list: ConvMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
}

export function listConvs(): ConvMeta[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function saveConv(id: string, title: string, entries: TimelineEntry[]) {
  // guard localStorage quota (~5MB): drop old entries if too big
  let payload = JSON.stringify(entries)
  while (payload.length > 2_000_000 && entries.length > 10) {
    entries = entries.slice(-20)
    payload = JSON.stringify(entries)
  }
  localStorage.setItem(KEY_PREFIX + id, payload)

  const idx = readIndex().filter(c => c.id !== id)
  idx.push({ id, title: title || '新对话', updatedAt: Date.now() })
  writeIndex(idx)
}

export function loadConv(id: string): TimelineEntry[] | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + id)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function deleteConv(id: string) {
  localStorage.removeItem(KEY_PREFIX + id)
  writeIndex(readIndex().filter(c => c.id !== id))
}

export function newConvId(): string {
  return `c${Date.now().toString(36)}`
}