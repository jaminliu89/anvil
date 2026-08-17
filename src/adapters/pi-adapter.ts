// pi-adapter — 非交互编码执行（pi -p）

import { invoke } from '@tauri-apps/api/core'
import type { Adapter, ExecutionResult } from './types'

export const piAdapter: Adapter = {
  id: 'pi',
  name: 'pi',
  description: '非交互编码执行。一次一个任务，结果直接返回。',
  commands: ['pi'],
  capabilities: [
    { type: 'execute', provider: 'sync', description: '同步执行编码任务' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    if (!args) {
      return { type: 'system', content: '用法: /pi <编码任务描述>' }
    }

    try {
      const result = await invoke('run_pi', { prompt: args })
      return { type: 'execution', content: String(result).slice(0, 5000) }
    } catch {
      return { type: 'system', content: 'pi 执行需要桌面环境（Tauri shell 权限）。dev 模式暂不支持。' }
    }
  },

  render() { /* TimelineView 内联渲染 */ },

  async status() {
    try {
      await invoke('check_pi_installed')
      return { available: true, healthy: true, message: 'pi 已安装' }
    } catch {
      return { available: true, healthy: false, message: 'pi 未检测到' }
    }
  },
}