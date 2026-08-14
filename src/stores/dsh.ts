import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type DshStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

export const useDshStore = defineStore('dsh', () => {
  const status = ref<DshStatus>('idle')
  const port = ref<number | null>(null)
  const error = ref<string | null>(null)
  const startedAt = ref<number | null>(null)

  const isRunning = computed(() => status.value === 'running')
  const isStarting = computed(() => status.value === 'starting')

  function setStatus(s: DshStatus) {
    status.value = s
    if (s === 'running') {
      startedAt.value = Date.now()
      error.value = null
    }
  }

  function setPort(p: number) {
    port.value = p
  }

  function setError(e: string) {
    status.value = 'error'
    error.value = e
  }

  return {
    status,
    port,
    error,
    startedAt,
    isRunning,
    isStarting,
    setStatus,
    setPort,
    setError,
  }
})
