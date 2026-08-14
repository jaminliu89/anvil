// 预设助手配置
import type { Assistant, AssistantId } from '@/types/assistant'

export const allAssistants: Assistant[] = [
  {
    id: 'writer',
    name: '小文',
    role: '文案写手',
    description: '写小红书、公众号、短视频文案、品牌故事、营销话术，让文字有温度有力量。',
    avatar: '',
    color: '#b8a990', // 暖石
    dshProfile: 'web',
    mode: 'creative',
    defaultPlugins: ['browser'],
  },
  {
    id: 'coder',
    name: '阿码',
    role: '代码工程师',
    description: '写代码、改 bug、做架构、解释代码逻辑，从前端到后端全栈覆盖。',
    avatar: '',
    color: '#8aa8b8', // 灰蓝
    dshProfile: 'web',
    mode: 'standard',
    defaultPlugins: ['browser'],
  },
  {
    id: 'researcher',
    name: '小研',
    role: '研究助理',
    description: '查资料、做调研、整理信息、对比竞品，帮你快速搞懂一个陌生领域。',
    avatar: '',
    color: '#9088b8', // 薰紫
    dshProfile: 'web',
    mode: 'standard',
    defaultPlugins: ['browser'],
  },
  {
    id: 'creator',
    name: '小创',
    role: '创意策划',
    description: '想点子、出方案、做策划、起名字，从 0 到 1 帮你破局。',
    avatar: '',
    color: '#c4a25a', // 琥珀
    dshProfile: 'web',
    mode: 'creative',
    defaultPlugins: ['browser'],
  },
]

export function getAssistant(id: string): Assistant | undefined {
  return allAssistants.find((a) => a.id === id)
}

export const assistantIds = allAssistants.map((a) => a.id) as AssistantId[]
