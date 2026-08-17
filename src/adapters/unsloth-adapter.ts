// unsloth-adapter — 训练（LoRA 微调 + 检查点 + 一键换脑）

import type { Adapter, ExecutionResult } from './types'

const BRIDGE = 'http://127.0.0.1:18443'

export const unslothAdapter: Adapter = {
  id: 'unsloth',
  name: 'Unsloth',
  description: 'LoRA 微调训练 + 模型导出 + 检查点管理。',
  commands: ['train', 'unsloth'],
  capabilities: [
    { type: 'train', provider: 'async', description: '启动 LoRA 训练任务' },
    { type: 'inspect', provider: 'sync', description: '训练进度 + 检查点列表' },
  ],

  async execute(_command: string, args: string): Promise<ExecutionResult> {
    const trimmed = args.trim()
    const sub = trimmed.split(/\s+/)[0]

    switch (sub) {
      case 'list': return listCheckpoints()
      case 'start': {
        const model = extractFlag(trimmed, '--model')
        const data = extractFlag(trimmed, '--data')
        return startTrain(model, data)
      }
      case 'status': return trainStatus()
      case 'stop': return stopTrain()
      case '': return { type: 'system', content: '用法: /train start|status|list|stop' }
      default: return { type: 'system', content: `未知子命令: ${sub}` }
    }
  },

  render() { /* TimelineView 内联渲染 */ },

  async status() {
    try {
      const res = await fetch(`${BRIDGE}/unsloth/status`, { signal: AbortSignal.timeout(2000) })
      const json = await res.json()
      return { available: true, healthy: json.alive, message: json.alive ? 'Unsloth 在线' : 'Unsloth 离线' }
    } catch {
      return { available: false, healthy: false, message: 'Unsloth 未检测到' }
    }
  },
}

function extractFlag(args: string, flag: string): string | undefined {
  const m = args.match(new RegExp(`${flag}\\s+(\\S+)`))
  return m?.[1]
}

async function startTrain(model?: string, data?: string): Promise<ExecutionResult> {
  if (!model) return { type: 'system', content: '用法: /train start --model <名称> --data <路径>' }
  try {
    const res = await fetch(`${BRIDGE}/unsloth/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, local_dataset: data }),
    })
    const json = await res.json()
    return { type: 'train', content: `训练已启动 (pid ${json.pid})。/train status 看进度。` }
  } catch {
    return { type: 'system', content: '训练启动失败（bridge 未启动）。' }
  }
}

async function trainStatus(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/unsloth/train-status`)
    const s = await res.json() as { running: boolean; step: number; loss: number; model: string }
    if (!s.running) return { type: 'train', content: '没有正在进行的训练。' }
    return { type: 'train', content: `训练中 · ${s.model} · step ${s.step} · loss ${s.loss.toFixed(4)}` }
  } catch {
    return { type: 'system', content: '状态查询失败。' }
  }
}

async function listCheckpoints(): Promise<ExecutionResult> {
  try {
    const res = await fetch(`${BRIDGE}/unsloth/checkpoints`)
    const json = await res.json() as { checkpoints: { name?: string; path?: string }[] }
    if (!json.checkpoints?.length) return { type: 'train', content: '没有检查点。' }
    return { type: 'train', content: json.checkpoints.map(c => c.name || c.path || '').join('\n') }
  } catch {
    return { type: 'system', content: '检查点查询失败。' }
  }
}

async function stopTrain(): Promise<ExecutionResult> {
  try {
    await fetch(`${BRIDGE}/unsloth/train-stop`, { method: 'POST' })
    return { type: 'train', content: '训练已停止。' }
  } catch {
    return { type: 'system', content: '停止失败。' }
  }
}