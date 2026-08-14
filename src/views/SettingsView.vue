<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { invoke } from '@tauri-apps/api/core'

const router = useRouter()
const settingsStore = useSettingsStore()

const saving = ref(false)
const saved = ref(false)

onMounted(async () => {
  await settingsStore.load()
})

async function save() {
  saving.value = true
  try {
    await settingsStore.save()

    // 同步开机自启
    try {
      if (settingsStore.autoStart) {
        await invoke('plugin:autostart|enable')
      } else {
        await invoke('plugin:autostart|disable')
      }
    } catch (e) {
      console.warn('设置开机自启失败', e)
    }

    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
  } finally {
    saving.value = false
  }
}

async function quit() {
  if (confirm('确定要退出鲸团吗？')) {
    await invoke('quit_app')
  }
}
</script>

<template>
  <div class="settings-view">
    <header class="settings-header">
      <button class="back-btn" @click="router.push('/')">← 返回团队</button>
      <h1>设置</h1>
    </header>

    <div class="settings-body">
      <section class="settings-section">
        <h2>通用</h2>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">开机自启</span>
            <span class="setting-desc">登录后自动在后台启动</span>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              v-model="settingsStore.autoStart"
              @change="save"
            />
            <span class="slider"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">全局快捷键</span>
            <span class="setting-desc">Option + Space 快速唤起 / 隐藏</span>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              v-model="settingsStore.globalShortcutEnabled"
              @change="save"
              disabled
            />
            <span class="slider"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">主题</span>
            <span class="setting-desc">选择显示主题</span>
          </div>
          <select v-model="settingsStore.theme" @change="save" class="select">
            <option value="dark">深色</option>
            <option value="light">浅色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">语言</span>
            <span class="setting-desc">界面显示语言</span>
          </div>
          <select v-model="settingsStore.language" @change="save" class="select">
            <option value="zh">简体中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      <section class="settings-section">
        <h2>AI 配置</h2>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">默认模型</span>
            <span class="setting-desc">新建对话时使用的模型</span>
          </div>
          <input
            v-model="settingsStore.defaultModel"
            class="input"
            @blur="save"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">API 地址</span>
            <span class="setting-desc">默认 DeepSeek 官方</span>
          </div>
          <input
            v-model="settingsStore.apiBaseUrl"
            class="input"
            placeholder="https://api.deepseek.com"
            @blur="save"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">API Key</span>
            <span class="setting-desc">已保存在本地</span>
          </div>
          <input
            v-model="settingsStore.apiKey"
            type="password"
            class="input"
            placeholder="sk-..."
            @blur="save"
          />
        </div>
      </section>

      <section class="settings-section">
        <h2>关于</h2>
        <div class="about-row">
          <span>版本</span>
          <span class="about-value">0.1.0</span>
        </div>
        <div class="about-row">
          <span>引擎</span>
          <span class="about-value">DeepSeek Harness</span>
        </div>
      </section>

      <section class="settings-section danger">
        <button class="quit-btn" @click="quit">退出鲸团</button>
        <p class="hint">关闭窗口会最小化到托盘，不退出应用</p>
      </section>
    </div>

    <!-- 保存提示 -->
    <transition name="fade">
      <div v-if="saved" class="save-toast">已保存</div>
    </transition>
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
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
  height: var(--header-height);
}

.back-btn {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.back-btn:hover {
  background: var(--color-bg-tertiary);
}

.settings-header h1 {
  font-size: var(--font-lg);
  font-weight: var(--font-semibold);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.settings-section {
  margin-bottom: var(--space-8);
}

.settings-section h2 {
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-3);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-soft);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.setting-title {
  font-size: var(--font-base);
  color: var(--color-text);
}

.setting-desc {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
}

.input {
  width: 280px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--color-text);
  text-align: right;
  transition: all var(--transition-fast);
}

.input:focus {
  border-color: var(--color-accent);
  outline: none;
}

.select {
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--color-text);
  cursor: pointer;
}

/* Switch 开关 */
.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  transition: 0.2s;
  border-radius: 22px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: var(--color-text-tertiary);
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
}

input:checked + .slider:before {
  transform: translateX(18px);
  background-color: #1a1a1a;
}

input:disabled + .slider {
  opacity: 0.4;
  cursor: not-allowed;
}

.about-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  font-size: var(--font-sm);
}

.about-value {
  color: var(--color-text-secondary);
}

.settings-section.danger {
  margin-top: var(--space-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.quit-btn {
  width: 100%;
  padding: var(--space-3);
  background: transparent;
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  font-size: var(--font-base);
  color: var(--color-error);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quit-btn:hover {
  background: rgba(237, 73, 86, 0.1);
}

.hint {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  text-align: center;
}

.save-toast {
  position: fixed;
  bottom: var(--space-8);
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-2) var(--space-6);
  background: var(--color-success);
  color: #1a1a1a;
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-pill);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
