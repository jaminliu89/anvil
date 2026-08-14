import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Assistant } from '@/types/assistant'
import { allAssistants, getAssistant } from '@/presets'

export const useTeamStore = defineStore('team', () => {
  const assistants = ref<Assistant[]>(allAssistants)
  const currentAssistantId = ref<string | null>(null)

  const currentAssistant = computed(() => {
    if (!currentAssistantId.value) return null
    return getAssistant(currentAssistantId.value) ?? null
  })

  function setCurrentAssistant(id: string) {
    currentAssistantId.value = id
  }

  return {
    assistants,
    currentAssistantId,
    currentAssistant,
    setCurrentAssistant,
  }
})
