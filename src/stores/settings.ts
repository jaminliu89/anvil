// 设置 store：应用配置（API key / 主题 / 自启 / 引导是否完成）

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
  const onboardingCompleted = ref(false)
  const apiKey = ref('')
  const apiBaseUrl = ref('')
  const defaultModel = ref('deepseek-v4-flash')
  const theme = ref<'dark' | 'light' | 'system'>('dark')
  const language = ref<'zh' | 'en'>('zh')
  const defaultAssistantId = ref<string>('')
  const globalShortcutEnabled = ref(false)
  const autoStart = ref(false)
  const approvalLevel = ref<'loose' | 'standard' | 'strict'>('standard')

  async function load() {
    const s = await getStore()
    const [
      oc,
      key,
      baseUrl,
      model,
      th,
      lang,
      def,
      gs,
      as,
      al,
    ] = await Promise.all([
      s.get<boolean>('onboardingCompleted'),
      s.get<string>('apiKey'),
      s.get<string>('apiBaseUrl'),
      s.get<string>('defaultModel'),
      s.get<'dark' | 'light' | 'system'>('theme'),
      s.get<'zh' | 'en'>('language'),
      s.get<string>('defaultAssistantId'),
      s.get<boolean>('globalShortcutEnabled'),
      s.get<boolean>('autoStart'),
      s.get<'loose' | 'standard' | 'strict'>('approvalLevel'),
    ])

    if (oc !== undefined) onboardingCompleted.value = oc
    if (key !== undefined) apiKey.value = key
    if (baseUrl !== undefined) apiBaseUrl.value = baseUrl
    if (model !== undefined) defaultModel.value = model
    if (th !== undefined) theme.value = th
    if (lang !== undefined) language.value = lang
    if (def !== undefined) defaultAssistantId.value = def
    if (gs !== undefined) globalShortcutEnabled.value = gs
    if (as !== undefined) autoStart.value = as
    if (al !== undefined) approvalLevel.value = al
  }

  async function save() {
    const s = await getStore()
    await Promise.all([
      s.set('onboardingCompleted', onboardingCompleted.value),
      s.set('apiKey', apiKey.value),
      s.set('apiBaseUrl', apiBaseUrl.value),
      s.set('defaultModel', defaultModel.value),
      s.set('theme', theme.value),
      s.set('language', language.value),
      s.set('defaultAssistantId', defaultAssistantId.value),
      s.set('globalShortcutEnabled', globalShortcutEnabled.value),
      s.set('autoStart', autoStart.value),
      s.set('approvalLevel', approvalLevel.value),
    ])
    await s.save()
  }

  /** 验证 API key 是否有效（简单格式检查，不实际调用） */
  function validateApiKey(key: string): string | null {
    if (!key.trim()) return '请输入 API key'
    if (key.length < 10) return 'API key 太短了'
    if (!key.startsWith('sk-') && !key.startsWith('ds-')) {
      return '看起来不像 DeepSeek API key（应该以 sk- 或 ds- 开头）'
    }
    return null
  }

  return {
    onboardingCompleted,
    apiKey,
    apiBaseUrl,
    defaultModel,
    theme,
    language,
    defaultAssistantId,
    globalShortcutEnabled,
    autoStart,
    approvalLevel,
    load,
    save,
    validateApiKey,
  }
})
