<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const theme = ref<'light' | 'dark'>('light')
const autostart = ref(true)
const autoLaunchAi = ref(true)
const notifications = ref(true)

onMounted(async () => {
  await settingsStore.load()
  theme.value = settingsStore.theme || 'light'
})
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">设置</h1>
    </div>

    <div class="settings">
      <!-- 通用 -->
      <div class="section">
        <div class="section-label">通用</div>
        <div class="setting-list">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">开机自启</span>
              <span class="setting-desc">登录 Mac 后自动打开 Anvil</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="autostart" />
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">自动运行</span>
              <span class="setting-desc">打开 Anvil 后自动启动 AI</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="autoLaunchAi" />
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">通知</span>
              <span class="setting-desc">运行状态变化时发送通知</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="notifications" />
              <span class="switch-track"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 外观 -->
      <div class="section">
        <div class="section-label">外观</div>
        <div class="setting-list">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">主题</span>
              <span class="setting-desc">亮色 / 暗色</span>
            </div>
            <div class="theme-toggle">
              <button
                class="theme-btn"
                :class="{ active: theme === 'light' }"
                @click="theme = 'light'"
              >亮色</button>
              <button
                class="theme-btn"
                :class="{ active: theme === 'dark' }"
                @click="theme = 'dark'"
              >暗色</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 关于 -->
      <div class="section">
        <div class="section-label">关于</div>
        <div class="setting-list">
          <div class="setting-item about-item">
            <div class="about-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            <div class="about-info">
              <span class="about-name">Anvil</span>
              <span class="about-ver">v0.1.0</span>
            </div>
            <span class="about-desc">你的本地 AI 工作站</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: var(--space-8) var(--space-8);
  max-width: 560px;
}

.page-head {
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--font-lg);
  font-weight: var(--font-semibold);
  letter-spacing: -0.01em;
}

/* 设置分组 */
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section-label {
  font-size: var(--font-2xs);
  font-weight: var(--font-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: var(--space-3);
}

.setting-list {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.setting-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--color-text);
}

.setting-desc {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}

/* 开关 */
.switch {
  position: relative;
  width: 36px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.switch-track {
  position: absolute;
  inset: 0;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  transition: all var(--transition-base);
}

.switch input:checked + .switch-track {
  background: var(--color-signal);
  border-color: var(--color-signal);
}

.switch-track::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: var(--color-bg);
  border-radius: 50%;
  transition: transform var(--transition-base);
}

.switch input:checked + .switch-track::after {
  transform: translateX(16px);
}

/* 主题切换 */
.theme-toggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.theme-btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-2xs);
  font-weight: var(--font-medium);
  font-family: inherit;
  cursor: pointer;
  border: none;
  color: var(--color-text-tertiary);
  background: var(--color-bg);
  transition: all var(--transition-fast);
}

.theme-btn.active {
  color: var(--color-bg);
  background: var(--color-signal);
}

.theme-btn:first-child {
  border-right: 1px solid var(--color-border-soft);
}

/* 关于 */
.about-item {
  gap: var(--space-3);
}

.about-logo {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--color-signal-soft);
  color: var(--color-signal);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.about-name {
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
}

.about-ver {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}

.about-desc {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}
</style>