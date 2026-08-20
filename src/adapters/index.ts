// 适配器统一注册入口 — TimelineView mount 时调用

import { register } from './registry'
import { lingAdapter } from './ling-adapter'
import { ollamaAdapter } from './ollama-adapter'
import { dockAdapter } from './dock-adapter'
import { julesAdapter } from './jules-adapter'
import { claudeAdapter } from './claude-adapter'
import { codexAdapter } from './codex-adapter'
import { openclawAdapter } from './openclaw-adapter'
import { reasonixAdapter } from './reasonix-adapter'
import { piAdapter } from './pi-adapter'
import { hermesAdapter } from './hermes-adapter'
import { antigravityAdapter } from './antigravity-adapter'
import { dshAdapter } from './dsh-adapter'
import { unslothAdapter } from './unsloth-adapter'

let initialized = false

export function registerAllAdapters() {
  if (initialized) return
  initialized = true

  // —— Agent 框架（默认兜底）——
  register(dshAdapter)

  // —— 云端编码 ——
  register(julesAdapter)
  register(claudeAdapter)
  register(openclawAdapter)
  register(codexAdapter)

  // —— 本地编码 ——
  register(dockAdapter)
  register(reasonixAdapter)
  register(piAdapter)
  register(hermesAdapter)
  register(antigravityAdapter)

  // —— 训练 ——
  register(unslothAdapter)

  // —— 本地聊天 ——
  register(lingAdapter)
  register(ollamaAdapter)
}