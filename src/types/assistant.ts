// 助手类型定义

export interface Assistant {
  id: string
  name: string
  role: string // 一句话定位
  description: string // 详细描述
  avatar: string // emoji 或 icon key（MVP 用 emoji）
  color: string // 品牌色变量名
  dshProfile: string // 对应的 DSH profile 名
  mode: 'standard' | 'ptc' | 'minimal' | 'creative'
  defaultPlugins: string[] // 默认启用的插件
  systemPrompt?: string // 自定义系统提示词
}

export type AssistantId = 'writer' | 'coder' | 'researcher' | 'creator'
