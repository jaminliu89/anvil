<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useTeamStore } from '@/stores/team'

const router = useRouter()
const settingsStore = useSettingsStore()
const teamStore = useTeamStore()

const step = ref(1)
const language = ref<'zh' | 'en'>('zh')
const apiKey = ref('')
const apiBaseUrl = ref('')
const selectedAssistant = ref('writer')
const isLoading = ref(false)

onMounted(async () => {
  await settingsStore.load()
  await teamStore.load()
})

const canNext = computed(() => {
  if (step.value === 1) return true
  if (step.value === 2) return apiKey.value.length > 5
  if (step.value === 3) return selectedAssistant.value !== ''
  return false
})

function next() {
  if (!canNext.value && step.value < 3) return
  if (step.value < 3) {
    step.value++
  } else {
    finish()
  }
}

function prev() {
  if (step.value > 1) step.value--
}

function selectAssistant(id: string) {
  selectedAssistant.value = id
}

function getInitial(name: string): string {
  return name.charAt(0)
}

async function finish() {
  isLoading.value = true
  try {
    settingsStore.language = language.value
    settingsStore.apiKey = apiKey.value.trim()
    if (apiBaseUrl.value.trim()) {
      settingsStore.apiBaseUrl = apiBaseUrl.value.trim()
    }
    settingsStore.onboardingCompleted = true
    await settingsStore.save()

    teamStore.setCurrentAssistant(selectedAssistant.value)
    await teamStore.save()

    // 等一下给个启动感
    await new Promise(r => setTimeout(r, 600))
    router.replace('/team')
  } catch (e) {
    console.error('onboarding finish failed', e)
    isLoading.value = false
  }
}
</script>

<template>
  <div class="view">
    <!-- 顶部拖拽区 -->
    <div class="titlebar-drag" data-tauri-drag-region></div>

    <!-- 进度点 -->
    <div class="steps">
      <span
        v-for="i in 3"
        :key="i"
        class="step-dot"
        :class="{ active: step === i, done: step > i }"
      ></span>
    </div>

    <!-- 内容 -->
    <div class="content">

      <!-- Step 1: 语言 -->
      <div v-if="step === 1" class="step-panel">
        <div class="brand-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="6" height="6" rx="1.5"></rect>
            <rect x="14" y="4" width="6" height="6" rx="1.5"></rect>
            <rect x="4" y="14" width="6" height="6" rx="1.5"></rect>
            <rect x="14" y="14" width="6" height="6" rx="1.5"></rect>
          </svg>
        </div>
        <h1 class="step-title">欢迎使用鲸团</h1>
        <p class="step-sub">选择你使用的语言</p>

        <div class="lang-options">
          <div
            class="lang-option"
            :class="{ selected: language === 'zh' }"
            @click="language = 'zh'"
          >
            <span class="lang-name">简体中文</span>
            <span class="lang-check" v-if="language === 'zh'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </div>
          <div
            class="lang-option"
            :class="{ selected: language === 'en' }"
            @click="language = 'en'"
          >
            <span class="lang-name">English</span>
            <span class="lang-check" v-if="language === 'en'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </div>
        </div>
      </div>

      <!-- Step 2: API Key -->
      <div v-if="step === 2" class="step-panel">
        <div class="step-num">2 / 3</div>
        <h1 class="step-title">输入你的 API Key</h1>
        <p class="step-sub">你的 key 只存在本地，不会上传</p>

        <div class="input-field">
          <input
            type="password"
            v-model="apiKey"
            class="api-input"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
            autocomplete="off"
          />
        </div>

        <details class="advanced">
          <summary>高级设置</summary>
          <input
            type="text"
            v-model="apiBaseUrl"
            class="adv-input"
            placeholder="自定义 Base URL（可选）"
          />
        </details>
      </div>

      <!-- Step 3: 选择助手 -->
      <div v-if="step === 3" class="step-panel">
        <div class="step-num">3 / 3</div>
        <h1 class="step-title">选择一位默认助手</h1>
        <p class="step-sub">每个助手都有不同的专长</p>

        <div class="assistant-options">
          <div
            v-for="a in teamStore.presetAssistants"
            :key="a.id"
            class="assistant-option"
            :class="{ selected: selectedAssistant === a.id }"
            @click="selectAssistant(a.id)"
          >
            <div class="opt-avatar" :style="{ backgroundColor: a.color + '15', color: a.color }">
              {{ getInitial(a.name) }}
            </div>
            <div class="opt-info">
              <span class="opt-name">{{ a.name }}</span>
              <span class="opt-role">{{ a.role }}</span>
            </div>
            <span class="opt-check" v-if="selectedAssistant === a.id">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <button
          v-if="step > 1"
          class="btn btn-ghost"
          @click="prev"
          :disabled="isLoading"
        >
          返回
        </button>
        <button
          class="btn btn-primary"
          @click="next"
          :disabled="!canNext || isLoading"
        >
          <template v-if="isLoading && step === 3">
            <span class="spinner"></span>
            启动中
          </template>
          <template v-else-if="step === 3">开始使用</template>
          <template v-else>继续</template>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg);
}

.titlebar-drag {
  width: 100%;
  height: var(--titlebar-height);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

/* 步骤点 */
.steps {
  display: flex;
  gap: 6px;
  margin-bottom: var(--space-6);
}

.step-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  transition: all var(--transition-base);
}

.step-dot.active {
  width: 18px;
  border-radius: 3px;
  background: var(--color-signal);
}

.step-dot.done {
  background: var(--color-text-tertiary);
}

/* 内容 */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 360px;
  padding: 0 var(--space-6);
}

.step-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand-mark {
  width: 40px;
  height: 40px;
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-signal-soft);
  color: var(--color-signal);
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-num {
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-3);
}

.step-title {
  font-size: var(--font-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-2);
  letter-spacing: -0.01em;
}

.step-sub {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-6);
}

/* 语言选择 */
.lang-options {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.lang-option:hover {
  border-color: var(--color-border);
}

.lang-option.selected {
  border-color: var(--color-signal);
  background: var(--color-signal-soft);
}

.lang-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
}

.lang-check {
  color: var(--color-signal);
}

/* API 输入 */
.input-field {
  width: 100%;
  margin-bottom: var(--space-3);
}

.api-input {
  width: 100%;
  height: 40px;
  padding: 0 var(--space-3);
  font-size: var(--font-sm);
  color: var(--color-text);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  text-align: center;
  transition: all var(--transition-base);
}

.api-input:focus {
  outline: none;
  border-color: var(--color-signal);
}

.advanced {
  width: 100%;
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
}

.advanced summary {
  cursor: pointer;
  list-style: none;
  text-align: center;
  padding: var(--space-2);
  transition: color var(--transition-fast);
}

.advanced summary:hover {
  color: var(--color-text-secondary);
}

.adv-input {
  width: 100%;
  height: 32px;
  padding: 0 var(--space-2);
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-sm);
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  text-align: center;
  margin-top: var(--space-2);
}

.adv-input:focus {
  outline: none;
  border-color: var(--color-border);
}

/* 助手选择 */
.assistant-options {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.assistant-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.assistant-option:hover {
  border-color: var(--color-border);
}

.assistant-option.selected {
  border-color: var(--color-signal);
  background: var(--color-signal-soft);
}

.opt-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.opt-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.opt-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
}

.opt-role {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}

.opt-check {
  color: var(--color-signal);
  flex-shrink: 0;
}

/* 按钮 */
.actions {
  margin-top: auto;
  margin-bottom: var(--space-8);
  display: flex;
  gap: var(--space-3);
  width: 100%;
}

.btn {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  font-family: inherit;
  cursor: pointer;
  border: none;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-text);
  color: var(--color-bg);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-ghost:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-bg-secondary);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
