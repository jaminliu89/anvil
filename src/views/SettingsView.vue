<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const theme = ref<'light' | 'dark'>('light')
const autostart = ref(true)
const autoLaunchAi = ref(true)
const notifications = ref(true)

function applyTheme(t: 'light' | 'dark') {
  document.documentElement.dataset.theme = t
  settingsStore.theme = t
  settingsStore.save()
}

watch(theme, (t) => applyTheme(t))

onMounted(async () => {
  await settingsStore.load()
  theme.value = settingsStore.theme || 'light'
  applyTheme(theme.value)
})
</script>

<template>
  <div class="settings-view">
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            <div class="about-info">
              <span class="about-name">Anvil</span>
              <span class="about-ver">v0.2.0</span>
            </div>
            <span class="about-desc">你的本地 AI 工作站</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view { padding: 12px 16px 16px; }

/* 设置分组 */
.settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--ink3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  padding: 0 2px;
}

.setting-list {
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-subtle);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
}

.setting-desc {
  font-size: 11px;
  color: var(--ink3);
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
  background: var(--muted);
  border: 1px solid var(--line);
  border-radius: 10px;
  transition: all 150ms ease;
}

.switch input:checked + .switch-track {
  background: var(--signal);
  border-color: var(--signal);
}

.switch-track::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: var(--canvas);
  border-radius: 50%;
  transition: transform 150ms ease;
}

.switch input:checked + .switch-track::after {
  transform: translateX(16px);
}

/* 主题切换 */
.theme-toggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}

.theme-btn {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: none;
  color: var(--ink3);
  background: var(--canvas);
  transition: all 120ms ease;
}

.theme-btn.active {
  color: var(--canvas);
  background: var(--signal);
}

.theme-btn:first-child {
  border-right: 1px solid var(--line);
}

/* 关于 */
.about-item {
  gap: 10px;
}

.about-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--signalSoft);
  color: var(--signal);
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
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.about-ver {
  font-size: 11px;
  color: var(--ink3);
}

.about-desc {
  font-size: 11px;
  color: var(--ink3);
}
</style>