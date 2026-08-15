// 设置 store：主题 / 自启 / 高级模式

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Store } from '@tauri-apps/plugin-store'

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('settings.json')
  }
  return store
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<'light' | 'dark'>('light')
  const autostart = ref(true)
  const autoStartService = ref(true)
  const notifications = ref(true)
  const advancedMode = ref(false)

  async function load() {
    try {
      const s = await getStore()
      const [th, as, asv, nt, adv] = await Promise.all([
        s.get<'light' | 'dark'>('theme'),
        s.get<boolean>('autostart'),
        s.get<boolean>('autoStartService'),
        s.get<boolean>('notifications'),
        s.get<boolean>('advancedMode'),
      ])
      if (th !== undefined) theme.value = th
      if (as !== undefined) autostart.value = as
      if (asv !== undefined) autoStartService.value = asv
      if (nt !== undefined) notifications.value = nt
      if (adv !== undefined) advancedMode.value = adv
    } catch {
      // 非 Tauri 环境（纯浏览器 dev）用 localStorage
      const adv = localStorage.getItem('anvil-advanced')
      if (adv !== null) advancedMode.value = adv === '1'
    }
  }

  async function save() {
    try {
      const s = await getStore()
      await Promise.all([
        s.set('theme', theme.value),
        s.set('autostart', autostart.value),
        s.set('autoStartService', autoStartService.value),
        s.set('notifications', notifications.value),
        s.set('advancedMode', advancedMode.value),
      ])
      await s.save()
    } catch {
      localStorage.setItem('anvil-advanced', advancedMode.value ? '1' : '0')
    }
  }

  function toggleAdvanced() {
    advancedMode.value = !advancedMode.value
  }

  return { theme, autostart, autoStartService, notifications, advancedMode, load, save, toggleAdvanced }
})
