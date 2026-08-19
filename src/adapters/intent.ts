// 意图猜测引擎 — 基于关键词规则匹配推荐最合适的 adapter
// 零依赖、快、可预期。不依赖 LLM，避免猜测延迟。

import { all } from './registry'

export interface IntentGuess {
  adapterId: string
  adapterName: string
  command?: string  // 如果是命令类，给出具体命令
  reason: string    // 简短理由，用于展示
  confidence: number // 0-1
  category: 'chat' | 'code' | 'research' | 'train' | 'system'
}

// 关键词规则表：按类别分组，匹配度越高分越高
const RULES: { pattern: RegExp; adapterId: string; command?: string; reason: string; confidence: number; category: IntentGuess['category'] }[] = [
  // —— 编码类 ——
  { pattern: /(改代码|重构|优化代码|代码有问题|debug|修复|bug|fix|refactor)/i, adapterId: 'dsh', command: 'dsh', reason: '涉及代码修改', confidence: 0.8, category: 'code' },
  { pattern: /(写个函数|写一个函数|写个脚本|写脚本|实现|生成代码|coding)/i, adapterId: 'dsh', command: 'dsh', reason: '需要写代码', confidence: 0.75, category: 'code' },
  { pattern: /(异步|后台|派任务|dock|worktree|分支)/i, adapterId: 'dock', command: 'dock', reason: '异步编码任务', confidence: 0.85, category: 'code' },
  { pattern: /(reasonix|前缀缓存|长会话|子agent|子智能体)/i, adapterId: 'reasonix', command: 'reasonix', reason: 'Reasonix 长编码', confidence: 0.9, category: 'code' },
  { pattern: /(pi |\/pi|非交互|批量执行)/i, adapterId: 'pi', command: 'pi', reason: '非交互编码', confidence: 0.8, category: 'code' },
  { pattern: /(codex|沙箱|配额|安全执行)/i, adapterId: 'codex', command: 'codex', reason: '沙箱执行', confidence: 0.85, category: 'code' },

  // —— 研究/搜索类 ——
  { pattern: /(分析|研究|调研|对比|查一下|搜索|新闻|最新|最近)/i, adapterId: 'dsh', command: 'dsh', reason: '需要多步分析', confidence: 0.7, category: 'research' },
  { pattern: /(agent loop|agent 循环|agent怎么工作|什么是agent)/i, adapterId: 'dsh', command: 'dsh', reason: 'Agent 框架相关', confidence: 0.9, category: 'research' },

  // —— 训练类 ——
  { pattern: /(训练|微调|lora|LoRA|fine.?tune|炼丹|模型训练)/i, adapterId: 'unsloth', command: 'train', reason: '模型训练', confidence: 0.9, category: 'train' },
  { pattern: /(导出模型|保存模型|量化)/i, adapterId: 'unsloth', command: 'train', reason: '训练相关', confidence: 0.8, category: 'train' },

  // —— 多步骤/复杂任务（默认走 agent loop）——
  { pattern: /(.{30,})/s, adapterId: 'dsh', command: 'dsh', reason: '复杂任务，多步处理更稳', confidence: 0.5, category: 'research' },
]

// 默认聊天类 adapter（按可用性排序）
const CHAT_ADAPTERS = ['ling', 'dsh']

export function guessIntent(text: string): IntentGuess | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return null // 命令不走猜测

  let best: IntentGuess | null = null

  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) {
      const adapter = all().find(a => a.id === rule.adapterId)
      if (!adapter) continue

      const guess: IntentGuess = {
        adapterId: rule.adapterId,
        adapterName: adapter.name,
        command: rule.command,
        reason: rule.reason,
        confidence: rule.confidence,
        category: rule.category,
      }

      if (!best || guess.confidence > best.confidence) {
        best = guess
      }
    }
  }

  // 如果没匹配到，默认走当前聊天 adapter
  if (!best) {
    const defaultId = CHAT_ADAPTERS.find(id => all().some(a => a.id === id)) || 'ling'
    const adapter = all().find(a => a.id === defaultId)
    if (adapter) {
      best = {
        adapterId: defaultId,
        adapterName: adapter.name,
        reason: '普通聊天',
        confidence: 0.6,
        category: 'chat',
      }
    }
  }

  return best
}

// 获取所有可用 adapter 列表（用于切换下拉）
export function listAvailableAdapters(): { id: string; name: string; description: string; category: string }[] {
  const categories: Record<string, string[]> = {
    '聊天': ['ling', 'dsh'],
    '编码': ['dock', 'reasonix', 'pi', 'codex', 'dsh'],
    '训练': ['unsloth'],
  }

  const result: { id: string; name: string; description: string; category: string }[] = []
  const allAdapters = all()

  for (const [cat, ids] of Object.entries(categories)) {
    for (const id of ids) {
      const a = allAdapters.find(ad => ad.id === id)
      if (a) {
        result.push({ id, name: a.name, description: a.description, category: cat })
      }
    }
  }

  return result
}
