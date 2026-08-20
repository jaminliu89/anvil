// 意图猜测引擎 — 基于关键词规则匹配推荐最合适的 adapter
// 零依赖、快、可预期。不依赖 LLM，避免猜测延迟。
// v2: 增加可用性过滤 + 系统操作类 + 更丰富的触发词

import { all } from './registry'
import type { Adapter } from './types'

export interface IntentGuess {
  adapterId: string
  adapterName: string
  command?: string  // 如果是命令类，给出具体命令
  reason: string    // 简短理由，用于展示
  confidence: number // 0-1
  category: 'chat' | 'code' | 'research' | 'train' | 'system'
  action?: 'open_drawer'  // 系统操作类型
  drawer?: string         // 要打开的抽屉 key
}

// —— 系统操作：打开某个抽屉/面板 ——
const SYSTEM_ACTIONS: { pattern: RegExp; drawer: string; reason: string; confidence: number }[] = [
  { pattern: /(打开.*设置|进.*设置|看.*设置|设置一下|配置|偏好设置)/i, drawer: 'settings', reason: '打开设置', confidence: 0.9 },
  { pattern: /(打开.*连接|连.*接|接入|对接|绑定|添加.*模型|模型.*连接)/i, drawer: 'connect', reason: '管理连接', confidence: 0.85 },
  { pattern: /(打开.*历史|看.*历史|历史记录|之前的对话|过往对话)/i, drawer: 'history', reason: '查看历史对话', confidence: 0.85 },
  { pattern: /(打开.*运行|运行时|runtime|看.*运行状态)/i, drawer: 'runtime', reason: '查看运行时', confidence: 0.8 },
  { pattern: /(训练|微调|lora|LoRA|fine.?tune|炼丹|模型训练|跑个训练)/i, drawer: 'train', reason: '启动训练', confidence: 0.85 },
  { pattern: /(守卫|guard|安全策略|权限|审批|沙箱)/i, drawer: 'guard', reason: '管理守卫', confidence: 0.8 },
]

// —— Agent 路由规则（按置信度从高到低排序不强制，后面统一比）——
const AGENT_RULES: { pattern: RegExp; adapterId: string; command?: string; reason: string; confidence: number; category: IntentGuess['category'] }[] = [
  // —— 编码类（高置信度）===
  { pattern: /(异步|后台|派任务|dock|worktree|分支上|开个分支)/i, adapterId: 'dock', command: 'dock', reason: '后台异步编码', confidence: 0.9, category: 'code' },
  { pattern: /(jules|jules-local|异步派|派给.*jules|jules.*改|google.*编码|云端.*编码)/i, adapterId: 'jules', command: 'jules', reason: 'Jules 云端编码', confidence: 0.9, category: 'code' },
  { pattern: /(claude.*code|claude.*改|用.*claude|克劳德.*编码|anthropic)/i, adapterId: 'claude', command: 'claude', reason: 'Claude Code 编码', confidence: 0.92, category: 'code' },
  { pattern: /(openclaw|claw|open.*ai.*编码|opencode)/i, adapterId: 'openclaw', command: 'openclaw', reason: 'OpenClaw 编码', confidence: 0.9, category: 'code' },
  { pattern: /(reasonix|前缀缓存|长会话编码|子agent|子智能体|多agent编码)/i, adapterId: 'reasonix', command: 'reasonix', reason: 'Reasonix 长编码', confidence: 0.92, category: 'code' },
  { pattern: /(codex|沙箱执行|安全执行|隔离执行)/i, adapterId: 'codex', command: 'codex', reason: 'Codex 沙箱编码', confidence: 0.88, category: 'code' },
  { pattern: /(pi |\/pi|非交互|批量执行|一次性跑)/i, adapterId: 'pi', command: 'pi', reason: 'Pi 非交互编码', confidence: 0.82, category: 'code' },
  { pattern: /(hermes.*改|hermes.*代码|用.*hermes.*写)/i, adapterId: 'hermes', command: 'hermes', reason: 'Hermes 编码任务', confidence: 0.8, category: 'code' },
  { pattern: /(antigravity|agy|gemini.*配对|agy.*本地|本地.*实时|实时编程|电脑.*权限)/i, adapterId: 'antigravity', command: 'agy', reason: 'Antigravity 本地编码', confidence: 0.92, category: 'code' },
  { pattern: /(gemini.*code|google.*code)/i, adapterId: 'dsh', command: 'dsh', reason: 'Gemini 编码任务', confidence: 0.8, category: 'code' },

  // === 编码类（通用触发词）===
  { pattern: /(改.*代码|代码.*有问题|代码.*报错|代码.*bug|代码.*修复|代码.*重构|代码.*优化)/i, adapterId: 'pi', command: 'pi', reason: '代码修改任务', confidence: 0.82, category: 'code' },
  { pattern: /(写.*函数|写.*脚本|写.*代码|实现.*功能|生成.*代码|coding|写个.*程序|写个.*工具)/i, adapterId: 'pi', command: 'pi', reason: '写代码任务', confidence: 0.78, category: 'code' },
  { pattern: /(debug|调试|排错|定位.*bug|找.*bug)/i, adapterId: 'pi', command: 'pi', reason: '调试排错', confidence: 0.8, category: 'code' },
  { pattern: /(refactor|重构|优化.*性能|优化.*代码|代码.*清理)/i, adapterId: 'pi', command: 'pi', reason: '代码重构', confidence: 0.76, category: 'code' },
  { pattern: /(用.*(python|js|ts|java|go|rust|c\+\+|cpp|ruby|php|swift|kotlin).*(写|实现|做))/i, adapterId: 'pi', command: 'pi', reason: '写代码任务', confidence: 0.8, category: 'code' },
  { pattern: /(快速排序|冒泡排序|二叉树|链表|算法题|leetcode|力扣|算法.*实现)/i, adapterId: 'pi', command: 'pi', reason: '算法实现', confidence: 0.75, category: 'code' },
  // 简单编码改动（改个/调整/修改/加个 + 样式/文案/函数/组件/按钮等）
  { pattern: /(改个|改一下|改下|调整下|调整一下|修改下|修改一下|加个|加一下|加个.*函数|加个.*按钮|加个.*样式|改.*样式|改.*颜色|改.*文案|改.*配置).*/i, adapterId: 'local-coding', command: 'local', reason: '简单代码改动（本地模型）', confidence: 0.55, category: 'code' },

  // === 研究/搜索类 ===
  { pattern: /(分析|研究|调研|对比|查一下|搜索|新闻|最新|最近.*进展|行业.*报告|市场.*分析)/i, adapterId: 'dsh', command: 'dsh', reason: '多步分析研究', confidence: 0.72, category: 'research' },
  { pattern: /(写文章|写一.*文章|写篇.*文章|写博客|写公众号|写作|撰文|长文)/i, adapterId: 'hermes', command: 'hermes', reason: 'Hermes 写作任务', confidence: 0.8, category: 'research' },
  { pattern: /(写报告|调研报告|研究报告|写方案|策划案|企划案)/i, adapterId: 'hermes', command: 'hermes', reason: 'Hermes 报告撰写', confidence: 0.82, category: 'research' },
  { pattern: /(深入研究|深度调研|全面分析|系统性研究|帮我研究|研究一下)/i, adapterId: 'hermes', command: 'hermes', reason: 'Hermes 深度研究', confidence: 0.85, category: 'research' },
  { pattern: /(agent loop|agent 循环|agent.*怎么.*工作|什么是agent|agent.*原理)/i, adapterId: 'dsh', command: 'dsh', reason: 'Agent 框架相关', confidence: 0.9, category: 'research' },
  { pattern: /(天气|今天.*天气|查.*天气)/i, adapterId: 'dsh', command: 'dsh', reason: '联网查询天气', confidence: 0.7, category: 'research' },
  { pattern: /(翻译|translate|翻一下|译成|翻译成)/i, adapterId: 'dsh', command: 'dsh', reason: '翻译任务', confidence: 0.68, category: 'chat' },
  { pattern: /(总结|摘要|概括|提炼|帮我看看这篇|总结一下)/i, adapterId: 'dsh', command: 'dsh', reason: '内容总结', confidence: 0.7, category: 'research' },

  // === 复杂任务兜底（长文本、多步骤描述）===
  { pattern: /.{50,}/s, adapterId: 'dsh', command: 'dsh', reason: '复杂任务，多步处理更稳', confidence: 0.55, category: 'research' },
]

// 编码任务降级链（按优先级从高到低）
// 上一层全挂才降入下一层，用户不感知切换
// 注意：claude 不进自动降级链（贵），只有用户明确指定 /claude 时才用
// local-coding 不在自动降级链里——它只处理简单任务（通过 classifyTask 判断）
// 复杂任务直接走云端链
export const CODE_FALLBACK_CHAIN = [
  'pi',         // 第 1 层 — Pi 主力编码（RPC 流式）
  'codex',      // 第 2 层 — Codex 沙箱安全执行
  'reasonix',   // 第 3 层 — Reasonix（前缀缓存 + 子agent）
  'dsh',        // 第 4 层 — agent loop 兜底
]

// 简单编码任务降级链（本地模型优先，不行再上云端）
export const SIMPLE_CODE_FALLBACK_CHAIN = [
  'local-coding', // 第 1 层 — 本地模型（沙箱隔离，不花 token）
  'pi',           // 第 2 层 — Pi 主力编码
  'codex',        // 第 3 层 — Codex
  'dsh',          // 第 4 层 — agent loop 兜底
]

// 研究/写作任务降级链
export const RESEARCH_FALLBACK_CHAIN = [
  'hermes',     // 第 1 层 — Hermes（深度研究 + 记忆 + 技能）
  'dsh',        // 第 2 层 — agent loop 兜底
]

// 聊天任务降级链
export const CHAT_FALLBACK_CHAIN = [
  'dsh',        // 第 1 层 — DSH bridge（云端模型 + 搜索增强）
  'ling',       // 第 2 层 — 本地模型离线兜底
]

// 兜底聊天 adapter 顺序（兼容旧引用）
const CHAT_FALLBACK = CHAT_FALLBACK_CHAIN

/**
 * 猜测意图并返回最佳匹配。
 * 自动过滤不可用的 adapter，找不到就退回到聊天类。
 */
export function guessIntent(text: string, availableIds?: string[]): IntentGuess | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return null // 命令不走猜测

  const allAdapters = all()
  const availSet = availableIds
    ? new Set(availableIds)
    : new Set(allAdapters.map(a => a.id))

  function adapterAvailable(id: string): boolean {
    return availSet.has(id) && allAdapters.some(a => a.id === id)
  }

  function findAdapter(id: string): Adapter | undefined {
    return allAdapters.find(a => a.id === id)
  }

  // 1. 先匹配系统操作（打开设置/历史/连接等）—— 这类最高优先级
  let best: IntentGuess | null = null
  for (const rule of SYSTEM_ACTIONS) {
    if (rule.pattern.test(trimmed)) {
      // 系统操作不依赖 adapter 可用性，直接命中
      best = {
        adapterId: 'system',
        adapterName: '系统',
        reason: rule.reason,
        confidence: rule.confidence,
        category: 'system',
        action: 'open_drawer',
        drawer: rule.drawer,
      }
      break // 系统操作命中第一个就够
    }
  }

  // 2. 匹配 agent 路由规则
  for (const rule of AGENT_RULES) {
    if (!rule.pattern.test(trimmed)) continue
    if (!adapterAvailable(rule.adapterId)) continue

    const adapter = findAdapter(rule.adapterId)
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

  // 3. 没匹配到 → 找第一个可用的聊天类 adapter 兜底
  if (!best) {
    for (const id of CHAT_FALLBACK) {
      if (adapterAvailable(id)) {
        const adapter = findAdapter(id)
        if (adapter) {
          best = {
            adapterId: id,
            adapterName: adapter.name,
            reason: '对话交流',
            confidence: 0.6,
            category: 'chat',
          }
          break
        }
      }
    }
  }

  return best
}

// 获取所有可用 adapter 列表（用于切换下拉）
export function listAvailableAdapters(): { id: string; name: string; description: string; category: string }[] {
  const categories: Record<string, string[]> = {
    'Agent 框架': ['dsh'],
    '云端编码': ['jules', 'claude', 'openclaw', 'codex'],
    '本地编码': ['dock', 'reasonix', 'pi', 'hermes', 'antigravity', 'local-coding'],
    '研究写作': ['hermes'],
    '训练': ['unsloth'],
    '本地聊天': ['ling', 'ollama'],
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

/**
 * 编码任务降级选择器。
 * 按复杂度选降级链：
 *   - 简单任务 → SIMPLE_CODE_FALLBACK_CHAIN（本地模型优先）
 *   - 复杂任务 → CODE_FALLBACK_CHAIN（直接云端）
 * 如果用户显式指定了某个编码 agent（高置信度命中特定名称），优先用那个，但它挂了也会自动降级。
 */
export function resolveCodeAdapter(
  intent: IntentGuess | null,
  availableIds?: string[],
  prompt?: string,
): string {
  const allAdapters = all()
  const availSet = availableIds
    ? new Set(availableIds)
    : new Set(allAdapters.map(a => a.id))

  function available(id: string): boolean {
    return availSet.has(id) && allAdapters.some(a => a.id === id)
  }

  // 用户明确点名了某个编码 agent → 优先尝试，但失败后也要降级
  if (intent?.category === 'code' && available(intent.adapterId)) {
    // 如果命中的就是降级链里的某个，从那个位置开始往下
    const chain = codeFallbackChainForPrompt(prompt, availSet, allAdapters)
    const idx = chain.indexOf(intent.adapterId)
    if (idx >= 0) {
      for (let i = idx; i < chain.length; i++) {
        if (available(chain[i])) return chain[i]
      }
    }
    // 不在降级链里的（比如 claude），用户点了名就先用，但后面还能降级
    return intent.adapterId
  }

  // 通用编码任务 → 按复杂度选降级链
  const chain = codeFallbackChainForPrompt(prompt, availSet, allAdapters)
  for (const id of chain) {
    if (available(id)) return id
  }

  // 全都不可用 → 返回 dsh 兜底（调用方会处理失败）
  return 'dsh'
}

/** 根据 prompt 选择编码降级链（简单任务优先本地，复杂任务直接云端） */
function codeFallbackChainForPrompt(
  prompt: string | undefined,
  _availSet: Set<string>,
  _allAdapters: Adapter[],
): string[] {
  // 没有 prompt → 默认走云端链（安全）
  if (!prompt) return CODE_FALLBACK_CHAIN

  // 动态导入（避免循环依赖）
  // 简单任务 → 本地优先
  // 这里用内联判断，不直接 import 防止循环依赖
  const isSimple = isSimpleTask(prompt)
  return isSimple ? SIMPLE_CODE_FALLBACK_CHAIN : CODE_FALLBACK_CHAIN
}

/** 任务分级（与 local-coding-adapter 的 classifyTask 同逻辑，内联避免循环依赖） */
function isSimpleTask(prompt: string): boolean {
  const text = prompt.toLowerCase()
  if (text.length > 300) return false

  const complexKeywords = [
    '重构', '架构', '系统', '框架', '跨文件', '多文件',
    '新增功能', '新功能', '模块', '组件', '插件',
    '数据库', '表', 'migration', 'api', '接口设计',
    '部署', '发布', 'ci', '测试用例', '集成',
    '登录', '鉴权', '权限', '支付',
  ]
  for (const kw of complexKeywords) {
    if (text.includes(kw.toLowerCase())) return false
  }

  const simpleKeywords = [
    '格式化', '格式调整', '美化', '缩进', '换行', '注释', '加注释',
    '改个', '改一下', '调整', '修改', '替换', '重命名', '改名',
    '文案', '标题', '改字', '改文字', '配置', '改配置', '常量',
    '日志', '加个日志', 'debug', '打印', 'console.log',
    '加个函数', '加个方法', '加个工具', '写个工具函数',
  ]
  for (const kw of simpleKeywords) {
    if (text.includes(kw.toLowerCase())) return true
  }

  if (text.length < 20) return true
  return false
}

/**
 * 编码任务的完整降级链（按顺序）。
 * 调用方可以用这个列表逐个尝试，直到一个成功。
 */
export function getCodeFallbackChain(availableIds?: string[]): string[] {
  const allAdapters = all()
  const availSet = availableIds
    ? new Set(availableIds)
    : new Set(allAdapters.map(a => a.id))

  function available(id: string): boolean {
    return availSet.has(id) && allAdapters.some(a => a.id === id)
  }

  return CODE_FALLBACK_CHAIN.filter(available)
}

/**
 * 研究/写作任务的降级选择器。
 * Hermes → dsh
 */
export function resolveResearchAdapter(
  intent: IntentGuess | null,
  availableIds?: string[],
): string {
  const allAdapters = all()
  const availSet = availableIds
    ? new Set(availableIds)
    : new Set(allAdapters.map(a => a.id))

  function available(id: string): boolean {
    return availSet.has(id) && allAdapters.some(a => a.id === id)
  }

  // 用户明确点名了 → 优先用
  if (intent?.category === 'research' && available(intent.adapterId)) {
    return intent.adapterId
  }

  for (const id of RESEARCH_FALLBACK_CHAIN) {
    if (available(id)) return id
  }
  return 'dsh'
}

export function getResearchFallbackChain(availableIds?: string[]): string[] {
  const allAdapters = all()
  const availSet = availableIds
    ? new Set(availableIds)
    : new Set(allAdapters.map(a => a.id))

  function available(id: string): boolean {
    return availSet.has(id) && allAdapters.some(a => a.id === id)
  }

  return RESEARCH_FALLBACK_CHAIN.filter(available)
}

/**
 * 聊天任务的降级选择器。
 * dsh → ling（本地模型兜底）
 */
export function resolveChatAdapter(availableIds?: string[]): string {
  const allAdapters = all()
  const availSet = availableIds
    ? new Set(availableIds)
    : new Set(allAdapters.map(a => a.id))

  function available(id: string): boolean {
    return availSet.has(id) && allAdapters.some(a => a.id === id)
  }

  for (const id of CHAT_FALLBACK_CHAIN) {
    if (available(id)) return id
  }
  return 'ling'
}

export function getChatFallbackChain(availableIds?: string[]): string[] {
  const allAdapters = all()
  const availSet = availableIds
    ? new Set(availableIds)
    : new Set(allAdapters.map(a => a.id))

  function available(id: string): boolean {
    return availSet.has(id) && allAdapters.some(a => a.id === id)
  }

  return CHAT_FALLBACK_CHAIN.filter(available)
}

/**
 * 通用解析：按 category 自动选对应降级链的第一个可用 adapter。
 */
export function resolveAdapter(
  category: IntentGuess['category'],
  intent: IntentGuess | null,
  availableIds?: string[],
): string {
  switch (category) {
    case 'code':
      return resolveCodeAdapter(intent, availableIds)
    case 'research':
      return resolveResearchAdapter(intent, availableIds)
    case 'chat':
    default:
      return resolveChatAdapter(availableIds)
  }
}

/**
 * 获取某个 category 的完整降级链。
 */
export function getFallbackChain(
  category: IntentGuess['category'],
  availableIds?: string[],
): string[] {
  switch (category) {
    case 'code':
      return getCodeFallbackChain(availableIds)
    case 'research':
      return getResearchFallbackChain(availableIds)
    case 'chat':
    default:
      return getChatFallbackChain(availableIds)
  }
}
