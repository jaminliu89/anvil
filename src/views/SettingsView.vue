<script setup lang="ts">
// 设置页 — Parchment 主题与偏好设置

import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const theme = ref<'light' | 'dark'>('light')
const autostart = ref(true)
const autoLaunchAi = ref(true)
const notifications = ref(true)

function setTheme(t: 'light' | 'dark') {
  theme.value = t
  settingsStore.theme = t
  if (t === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

onMounted(async () => {
  await settingsStore.load()
  theme.value = settingsStore.theme || 'light'
  setTheme(theme.value)
})
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">设置</h1>
      <p class="page-sub">工作站偏好设置与外观主题</p>
    </div>

    <div class="settings">
      <!-- 通用设置 -->
      <div class="section">
        <div class="section-label">通用偏好</div>
        <div class="setting-list">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">开机自启</span>
              <span class="setting-desc">登录 Mac 后自动后台启动 Anvil 工作站</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="autostart" />
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">自动就绪大脑</span>
              <span class="setting-desc">打开 Anvil 时自动启动本地 AI 守卫与推理端点</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="autoLaunchAi" />
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">桌面通知</span>
              <span class="setting-desc">模型切换或微调训练完成时发送通知</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="notifications" />
              <span class="switch-track"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 外观设置 -->
      <div class="section">
        <div class="section-label">外观视觉</div>
        <div class="setting-list">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">Parchment 色调</span>
              <span class="setting-desc">暖纸亮色 (Warm Paper) / 暖石暗色 (Dark Paper)</span>
            </div>
            <div class="theme-toggle">
              <button
                class="theme-btn"
                :class="{ active: theme === 'light' }"
                @click="setTheme('light')"
              >暖纸亮色</button>
              <button
                class="theme-btn"
                :class="{ active: theme === 'dark' }"
                @click="setTheme('dark')"
              >暖石暗色</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 关于信息 -->
      <div class="section">
        <div class="section-label">关于 Anvil</div>
        <div class="setting-list">
          <div class="setting-item about-item">
            <div class="about-logo">A</div>
            <div class="about-info">
              <span class="about-name">Anvil 本地 AI 工作站</span>
              <span class="about-ver">v0.1.0 · Parchment v3.2</span>
            </div>
            <span class="about-desc">离线独立 · 零 API 费用 · 全 GPU 加速</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: 32px 40px;
  max-width: 600px;
}

.page-head {
  margin-bottom: 24px;
}

.page-title {
  font-size: var(--font-xl);
  font-weight: var(--font-bold);
  color: var(--ink);
}

.page-sub {
  font-size: var(--font-sm);
  color: var(--ink3);
  margin-top: 2px;
}

.settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-label {
  font-size: 11px;
  font-weight: var(--font-semibold);
  color: var(--ink3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.setting-list {
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-name {
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  color: var(--ink);
}

.setting-desc {
  font-size: var(--font-xs);
  color: var(--ink3);
}

.switch {
  position: relative;
  width: 40px;
  height: 22px;
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
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 11px;
  transition: all var(--transition-base);
}

.switch input:checked + .switch-track {
  background: var(--signal);
  border-color: var(--signal);
}

.switch-track::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  top: 2px;
  background: var(--raised);
  border-radius: 50%;
  transition: transform var(--transition-base);
}

.switch input:checked + .switch-track::after {
  transform: translateX(18px);
}

.theme-toggle {
  display: flex;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.theme-btn {
  padding: 6px 12px;
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  border: none;
  color: var(--ink3);
  background: var(--surface);
  transition: all var(--transition-fast);
}

.theme-btn.active {
  color: var(--raised);
  background: var(--signal);
}

.about-item {
  gap: 14px;
}

.about-logo {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--signal);
  color: var(--raised);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-bold);
  font-size: var(--font-md);
  flex-shrink: 0;
}

.about-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.about-name {
  font-size: var(--font-sm);
  font-weight: var(--font-bold);
  color: var(--ink);
}

.about-ver {
  font-size: var(--font-xs);
  color: var(--ink3);
}

.about-desc {
  font-size: var(--font-xs);
  color: var(--ink3);
}
</style>