// 守卫服务 store

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { sidecarAlive } from '@/services/dsh'
import { listen } from '@tauri-apps/api/event'

export const useDshStore = defineStore('dsh', () => {
  const status = ref<'idle' | 'starting' | 'running' | 'error'>('idle')
  const port = ref<number | null>(null)
  const target = ref('http://localhost:18080/v1')
  const message = ref<string | null>(null)
  const salvageCount = ref(0)

  async function refresh() {
    try {
      const s = await invoke<{ status: string; port: number | null; target: string; message: string | null }>('dsh_status')
      status.value = s.status as typeof status.value
      port.value = s.port
      target.value = s.target
      message.value = s.message
    } catch {
      // 非 Tauri 环境（纯浏览器 dev）：探测 sidecar
      if (await sidecarAlive()) {
        status.value = 'running'
        port.value = 18443
      } else {
        status.value = 'error'
        message.value = '守卫服务未启动'
      }
    }
  }

  async function start() {
    try {
      await invoke('dsh_start')
    } catch {
      /* dev 模式忽略 */
    }
    await refresh()
  }

  async function setTarget(t: string) {
    try {
      await invoke('dsh_set_target', { target: t })
    } catch {
      /* dev 模式忽略 */
    }
    await refresh()
  }

  function setupEvents() {
    listen<number>('sidecar-ready', (e) => {
      status.value = 'running'
      port.value = e.payload
    }).catch(() => {})
    listen<string>('sidecar-error', (e) => {
      status.value = 'error'
      message.value = e.payload
    }).catch(() => {})
  }

  return { status, port, target, message, salvageCount, refresh, start, setTarget, setupEvents }
})
