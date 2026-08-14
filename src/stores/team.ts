import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Store } from '@tauri-apps/plugin-store'
import type { Assistant } from '@/types/assistant'
import { allAssistants } from '@/presets'

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('settings.json')
  }
  return store
}

export const useTeamStore = defineStore('team', () => {
  // 内置预设助手
  const presetAssistants = ref<Assistant[]>(allAssistants)
  // 自定义助手（用户创建的）
  const customAssistants = ref<Assistant[]>([])
  // 当前选中的助手 ID
  const currentAssistantId = ref<string>('')

  // 全部助手（预设 + 自定义）
  const assistants = computed(() => [...presetAssistants.value, ...customAssistants.value])

  // 当前助手
  const currentAssistant = computed(() => {
    if (!currentAssistantId.value) return null
    return assistants.value.find((a) => a.id === currentAssistantId.value) || null
  })

  // 从本地存储加载自定义助手
  async function load() {
    const s = await getStore()
    const customs = await s.get<Assistant[]>('customAssistants')
    if (customs) {
      customAssistants.value = customs
    }
    const current = await s.get<string>('currentAssistantId')
    if (current) {
      currentAssistantId.value = current
    }
  }

  // 保存到本地存储
  async function save() {
    const s = await getStore()
    await s.set('customAssistants', customAssistants.value)
    await s.set('currentAssistantId', currentAssistantId.value)
    await s.save()
  }

  function setCurrentAssistant(id: string) {
    currentAssistantId.value = id
    save()
  }

  // 新增自定义助手
  async function addAssistant(assistant: Assistant) {
    // 确保 id 唯一
    const id = assistant.id || `custom-${Date.now()}`
    const newAssistant: Assistant = {
      ...assistant,
      id,
      isCustom: true,
    }
    customAssistants.value.push(newAssistant)
    await save()
    return newAssistant
  }

  // 更新助手
  async function updateAssistant(id: string, updates: Partial<Assistant>) {
    const idx = customAssistants.value.findIndex((a) => a.id === id)
    if (idx >= 0) {
      customAssistants.value[idx] = {
        ...customAssistants.value[idx],
        ...updates,
      }
      await save()
    }
  }

  // 删除助手
  async function deleteAssistant(id: string) {
    const idx = customAssistants.value.findIndex((a) => a.id === id)
    if (idx >= 0) {
      customAssistants.value.splice(idx, 1)
      if (currentAssistantId.value === id) {
        currentAssistantId.value = presetAssistants.value[0]?.id || ''
      }
      await save()
    }
  }

  // 检查是否是自定义助手
  function isCustom(id: string): boolean {
    return customAssistants.value.some((a) => a.id === id)
  }

  return {
    presetAssistants,
    customAssistants,
    assistants,
    currentAssistant,
    currentAssistantId,
    load,
    save,
    setCurrentAssistant,
    addAssistant,
    updateAssistant,
    deleteAssistant,
    isCustom,
  }
})
