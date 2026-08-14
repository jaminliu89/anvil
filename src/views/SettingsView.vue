<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { invoke } from '@tauri-apps/api/core'

const router = useRouter()
const settingsStore = useSettingsStore()

const apiKeyInput = ref('')
const apiBaseUrlInput = ref('')
const modelInput = ref('')
const themeInput = ref<'dark' | 'light' | 'system'>('dark')
const autostart = ref(false)
const shortcutEnabled = ref(true)
const saveSuccess = ref(false)
const saveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

const settingsReady = ref(false)

onMounted(async () => {
  await settingsStore.load()
  settingsReady.value = true
  apiKeyInput.value = settingsStore.apiKey
  apiBaseUrlInput.value = settingsStore.apiBaseUrl
  modelInput.value = settingsStore.defaultModel
  themeInput.value = settingsStore.theme
  autostart.value = settingsStore.autoStart
  shortcutEnabled.value = settingsStore.globalShortcutEnabled
  applyTheme(themeInput.value)
})

function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme
}

function showSaveIndicator() {
  saveSuccess.value = true
  if (saveTimeout.value) clearTimeout(saveTimeout.value)
  saveTimeout.value = setTimeout(() => {
    saveSuccess.value = false
  }, 1500)
}

async function saveApiKey() {
  settingsStore.apiKey = apiKeyInput.value
  settingsStore.apiBaseUrl = apiBaseUrlInput.value
  settingsStore.defaultModel = modelInput.value
  await settingsStore.save()
  showSaveIndicator()
}

async function saveTheme() {
  settingsStore.theme = themeInput.value
  applyTheme(themeInput.value)
  await settingsStore.save()
  showSaveIndicator()
}

async function toggleAutostart() {
  settingsStore.autoStart = autostart.value
  await settingsStore.save()
  // 通知 Rust 侧
  try {
    await invoke('set_autostart', { enabled: autostart.value })
  } catch {
    // 忽略，插件可能没装好
  }
  showSaveIndicator()
}

async function toggleShortcut() {
  settingsStore.globalShortcutEnabled = shortcutEnabled.value
  await settingsStore.save()
  try {
    if (shortcutEnabled.value) {
      await invoke('register_shortcut')
    } else {
      await invoke('unregister_shortcut')
    }
  } catch {
    // 忽略
  }
  showSaveIndicator()
}

function quitApp() {
  if (confirm('确定要退出鲸团吗？')) {
    invoke('do_quit_app').catch(() => {})
  }
}

function back() {
  router.back()
}
</script>

<template>
  <div class="settings-view">
    <header class="settings-header">
      <button class="back-btn" @click="back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <h1>设置</h1>
      <div class="save-indicator" :class="{ visible: saveSuccess }">
        已保存
      </div>
    </header>

    <div v-if="settingsReady" class="settings-body">
      <!-- 通用 -->
      <section class="settings-section">
        <h2 class="section-title">通用</h2>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">主题</span>
            <span class="setting-desc">界面显示风格</span>
          </div>
          <select v-model="themeInput" class="select" @change="saveTheme">
            <option value="dark">深色</option>
            <option value="light">浅色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">开机自启</span>
            <span class="setting-desc">登录时自动启动鲸团</span>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="autostart" @change="toggleAutostart" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">全局快捷键</span>
            <span class="setting-desc">Option + Space 唤起/隐藏窗口</span>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="shortcutEnabled" @change="toggleShortcut" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </section>

      <!-- AI 配置 -->
      <section class="settings-section">
        <h2 class="section-title">AI 配置</h2>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">API Key</span>
            <span class="setting-desc">DeepSeek API 密钥</span>
          </div>
          <input
            v-model="apiKeyInput"
            class="input-inline"
            type="password"
            placeholder="sk-..."
            @blur="saveApiKey"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">API 地址</span>
            <span class="setting-desc">默认 DeepSeek 官方</span>
          </div>
          <input
            v-model="apiBaseUrlInput"
            class="input-inline"
            placeholder="https://api.deepseek.com"
            @blur="saveApiKey"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">默认模型</span>
            <span class="setting-desc">对话使用的模型</span>
          </div>
          <input
            v-model="modelInput"
            class="input-inline"
            placeholder="deepseek-chat"
            @blur="saveApiKey"
          />
        </div>
      </section>

      <!-- 关于 -->
      <section class="settings-section">
        <h2 class="section-title">关于</h2>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">版本</span>
            <span class="setting-desc">当前安装版本</span>
          </div>
          <span class="setting-value">v0.1.0</span>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">底层引擎</span>
            <span class="setting-desc">DeepSeek Harness</span>
          </div>
          <span class="setting-value">DSH</span>
        </div>
      </section>

      <!-- 退出 -->
      <section class="settings-section danger-section">
        <button class="danger-btn" @click="quitApp">退出鲸团</button>
        <p class="danger-hint">关闭窗口不会退出，鲸团会在后台运行</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.settings-header {
  height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
  position: relative;
}

.back-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.back-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-tertiary);
}

.settings-header h1 {
  font-size: var(--font-md);
  font-weight: var(--font-medium);
}

.save-indicator {
  position: absolute;
  right: var(--space-4);
  font-size: var(--font-xs);
  color: var(--color-success);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.save-indicator.visible {
  opacity: 1;
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8);
  max-width: 560px;
  margin: 0 auto;
  width: 100%;
}

.settings-section {
  margin-bottom: var(--space-8);
}

.section-title {
  font-size: var(--font-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: var(--space-3);
  padding-left: var(--space-2);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-soft);
}

.setting-item:first-child {
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.setting-item:last-child {
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  border-bottom: none;
}

.setting-item:only-child {
  border-radius: var(--radius-md);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  font-size: var(--font-sm);
  color: var(--color-text);
}

.setting-desc {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.setting-value {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
}

.select {
  padding: var(--space-1) var(--space-3);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--color-text);
  cursor: pointer;
  outline: none;
}

.select:focus {
  border-color: var(--color-border-strong);
}

.input-inline {
  width: 200px;
  padding: var(--space-1) var(--space-3);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--color-text);
  text-align: right;
  outline: none;
  transition: all var(--transition-fast);
}

.input-inline:focus {
  border-color: var(--color-accent);
}

/* Toggle */
.toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  transition: all var(--transition-fast);
}

.toggle-slider::before {
  content: "";
  position: absolute;
  top: 1px;
  left: 1px;
  width: 16px;
  height: 16px;
  background: var(--color-text-tertiary);
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.toggle input:checked + .toggle-slider {
  background: var(--color-accent-soft);
  border-color: transparent;
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(16px);
  background: var(--color-accent);
}

/* 危险区 */
.danger-section {
  text-align: center;
  padding-top: var(--space-4);
}

.danger-btn {
  padding: var(--space-2) var(--space-6);
  color: var(--color-error);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.danger-btn:hover {
  background: rgba(192, 108, 108, 0.1);
  border-color: var(--color-error);
}

.danger-hint {
  margin-top: var(--space-3);
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
