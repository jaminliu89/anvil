<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { invoke } from '@tauri-apps/api/core'

const router = useRouter()
const settingsStore = useSettingsStore()

const apiKeyInput = ref('')
const apiBaseUrlInput = ref('')
const autostart = ref(false)
const shortcutEnabled = ref(false)
const themeInput = ref<'dark' | 'light' | 'system'>('dark')
const saved = ref(false)
const ready = ref(false)

onMounted(async () => {
  await settingsStore.load()
  ready.value = true
  apiKeyInput.value = settingsStore.apiKey
  apiBaseUrlInput.value = settingsStore.apiBaseUrl
  autostart.value = settingsStore.autoStart
  shortcutEnabled.value = settingsStore.globalShortcutEnabled
  themeInput.value = settingsStore.theme
})

function back() {
  router.back()
}

async function saveApiKey() {
  settingsStore.apiKey = apiKeyInput.value.trim()
  await settingsStore.save()
  showSaved()
}

async function saveApiBaseUrl() {
  settingsStore.apiBaseUrl = apiBaseUrlInput.value.trim()
  await settingsStore.save()
  showSaved()
}

async function toggleAutostart() {
  settingsStore.autoStart = autostart.value
  await settingsStore.save()
  try {
    await invoke('set_autostart', { enabled: autostart.value })
  } catch (e) {
    console.warn('set autostart failed', e)
  }
  showSaved()
}

async function toggleShortcut() {
  settingsStore.globalShortcutEnabled = shortcutEnabled.value
  await settingsStore.save()
  try {
    await invoke('set_global_shortcut', { enabled: shortcutEnabled.value })
  } catch (e) {
    console.warn('set shortcut failed', e)
  }
  showSaved()
}

async function saveTheme() {
  settingsStore.theme = themeInput.value
  await settingsStore.save()
  showSaved()
}

function showSaved() {
  saved.value = true
  setTimeout(() => { saved.value = false }, 1500)
}

async function quitApp() {
  try {
    await invoke('quit_app')
  } catch (e) {
    console.warn('quit failed', e)
  }
}
</script>

<template>
  <div class="view" v-if="ready">
    <!-- 标题栏 -->
    <header class="titlebar" data-tauri-drag-region>
      <div class="titlebar-left">
        <button class="back-btn" @click="back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span class="back-text">返回</span>
      </div>
      <div class="titlebar-center" data-tauri-drag-region>
        <span class="page-title">设置</span>
      </div>
      <div class="titlebar-right">
        <span class="save-indicator" :class="{ visible: saved }">已保存</span>
      </div>
    </header>

    <!-- 主体 -->
    <main class="main">
      <div class="panel">

        <div class="group">
          <div class="group-title">AI 服务</div>
          <div class="group-body">
            <div class="row">
              <div class="row-label">
                <span class="label-text">API Key</span>
                <span class="label-sub">DeepSeek API Key</span>
              </div>
              <input
                type="password"
                v-model="apiKeyInput"
                class="row-input"
                placeholder="sk-..."
                @blur="saveApiKey"
                @keyup.enter="saveApiKey"
              />
            </div>
            <div class="row">
              <div class="row-label">
                <span class="label-text">接口地址</span>
                <span class="label-sub">自定义 API Base URL</span>
              </div>
              <input
                type="text"
                v-model="apiBaseUrlInput"
                class="row-input"
                placeholder="https://api.deepseek.com"
                @blur="saveApiBaseUrl"
                @keyup.enter="saveApiBaseUrl"
              />
            </div>
          </div>
        </div>

        <div class="group">
          <div class="group-title">通用</div>
          <div class="group-body">
            <div class="row">
              <div class="row-label">
                <span class="label-text">开机自启</span>
                <span class="label-sub">登录后自动启动鲸团</span>
              </div>
              <div class="switch" :class="{ on: autostart }" @click="toggleAutostart">
                <div class="thumb"></div>
              </div>
            </div>
            <div class="row">
              <div class="row-label">
                <span class="label-text">全局快捷键</span>
                <span class="label-sub">⌥␣ 快速唤起 / 隐藏</span>
              </div>
              <div class="switch" :class="{ on: shortcutEnabled }" @click="toggleShortcut">
                <div class="thumb"></div>
              </div>
            </div>
            <div class="row">
              <div class="row-label">
                <span class="label-text">外观</span>
                <span class="label-sub">深色 / 浅色 / 跟随系统</span>
              </div>
              <div class="segmented">
                <div
                  class="seg-item"
                  :class="{ active: themeInput === 'dark' }"
                  @click="themeInput = 'dark'; saveTheme()"
                >深色</div>
                <div
                  class="seg-item"
                  :class="{ active: themeInput === 'light' }"
                  @click="themeInput = 'light'; saveTheme()"
                >浅色</div>
                <div
                  class="seg-item"
                  :class="{ active: themeInput === 'system' }"
                  @click="themeInput = 'system'; saveTheme()"
                >跟随</div>
              </div>
            </div>
          </div>
        </div>

        <div class="group">
          <div class="group-title">关于</div>
          <div class="group-body">
            <div class="row static">
              <div class="row-label">
                <span class="label-text">版本</span>
              </div>
              <span class="row-value">0.1.0</span>
            </div>
            <div class="row clickable" @click="quitApp">
              <div class="row-label">
                <span class="label-text danger">退出鲸团</span>
              </div>
              <svg class="row-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </div>

      </div>
    </main>
  </div>
</template>

<style scoped>
.view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

/* 标题栏 */
.titlebar {
  height: var(--titlebar-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  -webkit-app-region: drag;
}

.titlebar-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  -webkit-app-region: no-drag;
}

.back-btn {
  width: 22px;
  height: 22px;
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

.back-text {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.back-text:hover {
  color: var(--color-text);
}

.titlebar-center {
  flex: 1;
  text-align: center;
}

.page-title {
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.titlebar-right {
  flex: 1;
  text-align: right;
  -webkit-app-region: no-drag;
}

.save-indicator {
  font-size: var(--font-xs);
  color: var(--color-success);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.save-indicator.visible {
  opacity: 1;
}

/* 主体 */
.main {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8) var(--space-10);
  display: flex;
  justify-content: center;
}

.panel {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.group-title {
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0 var(--space-2);
}

.group-body {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
  min-height: 44px;
}

.row:last-child {
  border-bottom: none;
}

.row.clickable {
  cursor: pointer;
  transition: all var(--transition-fast);
}

.row.clickable:hover {
  background: var(--color-bg-tertiary);
}

.row-label {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.label-text {
  font-size: var(--font-sm);
  font-weight: var(--font-regular);
  color: var(--color-text);
}

.label-text.danger {
  color: var(--color-error);
}

.label-sub {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}

.row-input {
  flex: 1;
  max-width: 200px;
  height: 26px;
  padding: 0 var(--space-2);
  font-size: var(--font-sm);
  color: var(--color-text);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-sm);
  text-align: right;
  font-family: inherit;
  transition: all var(--transition-fast);
}

.row-input:focus {
  outline: none;
  border-color: var(--color-border-strong);
  background: var(--color-bg-elevated);
}

.row-value {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
}

.row-chevron {
  color: var(--color-text-muted);
}

/* 开关 */
.switch {
  width: 36px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-soft);
  padding: 1px;
  cursor: pointer;
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.switch .thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  transition: all var(--transition-base);
}

.switch.on {
  background: var(--color-signal-soft);
  border-color: var(--color-signal);
}

.switch.on .thumb {
  transform: translateX(14px);
  background: var(--color-signal);
}

/* 分段控件 */
.segmented {
  display: flex;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  padding: 2px;
  gap: 1px;
}

.seg-item {
  padding: 2px var(--space-2);
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.seg-item:hover {
  color: var(--color-text-secondary);
}

.seg-item.active {
  background: var(--color-bg-elevated);
  color: var(--color-text);
  font-weight: var(--font-medium);
}
</style>
