// 设置 store：主题 / 自启 / 运行偏好

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
  const theme = ref<'dark' | 'light'>('light')
  const autostart = ref(true)
  const autoLaunchAi = ref(true)
  const notifications = ref(true)

  async function load() {
    const s = await getStore()
    const [th, as, al, nt] = await Promise.all([
      s.get<'dark' | 'light'>('theme'),
      s.get<boolean>('autostart'),
      s.get<boolean>('autoLaunchAi'),
      s.get<boolean>('notifications'),
    ])
    if (th !== undefined) theme.value = th
    if (as !== undefined) autostart.value = as
    if (al !== undefined) autoLaunchAi.value = al
    if (nt !== undefined) notifications.value = nt
  }

  async function save() {
    const s = await getStore()
    await Promise.all([
      s.set('theme', theme.value),
      s.set('autostart', autostart.value),
      s.set('autoLaunchAi', autoLaunchAi.value),
      s.set('notifications', notifications.value),
    ])
    await s.save()
  }

  return {
    theme,
    autostart,
    autoLaunchAi,
    notifications,
    load,
    save,
  }
})