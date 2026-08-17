// 适配器统一注册入口 — TimelineView mount 时调用

import { register } from './registry'
import { lingAdapter } from './ling-adapter'
import { dockAdapter } from './dock-adapter'
import { piAdapter } from './pi-adapter'
import { codexAdapter } from './codex-adapter'
import { reasonixAdapter } from './reasonix-adapter'
import { dshAdapter } from './dsh-adapter'
import { unslothAdapter } from './unsloth-adapter'

let initialized = false

export function registerAllAdapters() {
  if (initialized) return
  initialized = true

  register(lingAdapter)
  register(dockAdapter)
  register(piAdapter)
  register(codexAdapter)
  register(reasonixAdapter)
  register(dshAdapter)
  register(unslothAdapter)
}