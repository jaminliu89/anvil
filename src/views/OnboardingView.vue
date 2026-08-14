<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useTeamStore } from '@/stores/team'

const router = useRouter()
const settingsStore = useSettingsStore()
const teamStore = useTeamStore()

const step = ref(0) // 0: welcome / 1: language / 2: apikey / 3: assistant

function getInitial(name: string): string {
  return name.charAt(0)
}

const totalSteps = 3
const progress = computed(() => (step.value / totalSteps) * 100)

// 语言
const language = ref<'zh' | 'en'>('zh')

// API key
const apiKeyInput = ref('')
const apiKeyError = ref('')
const apiBaseUrlInput = ref('https://api.deepseek.com')

// 助手
const selectedAssistant = ref('')

onMounted(async () => {
  await settingsStore.load()
  await teamStore.load()
  if (teamStore.presetAssistants.length > 0) {
    selectedAssistant.value = teamStore.presetAssistants[0].id
  }
})

function nextStep() {
  step.value++
}

function prevStep() {
  if (step.value > 0) step.value--
}

function validateApiKey(): boolean {
  const key = apiKeyInput.value.trim()
  if (!key) {
    apiKeyError.value = '请输入 API Key'
    return false
  }
  if (!key.startsWith('sk-')) {
    apiKeyError.value = 'API Key 格式不正确，应为 sk- 开头'
    return false
  }
  apiKeyError.value = ''
  return true
}

function handleNext() {
  if (step.value === 1) {
    // 语言页，直接进入
    nextStep()
  } else if (step.value === 2) {
    // API key 验证
    if (validateApiKey()) {
      nextStep()
    }
  } else if (step.value === 3) {
    // 完成
    finishOnboarding()
  }
}

async function finishOnboarding() {
  settingsStore.language = language.value
  settingsStore.apiKey = apiKeyInput.value.trim()
  settingsStore.apiBaseUrl = apiBaseUrlInput.value.trim()
  settingsStore.onboardingCompleted = true
  await settingsStore.save()

  if (selectedAssistant.value) {
    teamStore.setCurrentAssistant(selectedAssistant.value)
  }

  router.replace('/')
}

function selectAssistant(id: string) {
  selectedAssistant.value = id
}
</script>

<template>
  <div class="onboarding-view">
    <!-- 顶部拖拽区 -->
    <div class="titlebar-drag" data-tauri-drag-region></div>
    <div class="onboarding-container">
      <!-- 进度条 -->
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>

      <!-- 步骤指示 -->
      <div class="step-dots">
        <span
          v-for="i in totalSteps"
          :key="i"
          class="step-dot"
          :class="{ active: step >= i, completed: step > i }"
        ></span>
      </div>

      <!-- 欢迎页（Step 0） -->
      <div v-if="step === 0" class="step-content welcome-step">
        <div class="logo-mark"></div>
        <h1>鲸团</h1>
        <p class="subtitle">你的第一个 AI 助手团队</p>
        <p class="desc">
          一键启动多个 AI 助手，写文案、写代码、做研究，各司其职。
        </p>
        <button class="primary-btn" @click="nextStep">
          开始使用
        </button>
        <p class="footnote">无需命令行，开箱即用</p>
      </div>

      <!-- 语言选择（Step 1） -->
      <div v-if="step === 1" class="step-content">
        <h2>选择语言</h2>
        <p class="step-desc">选择你的界面语言</p>

        <div class="option-list">
          <div
            class="option-item"
            :class="{ selected: language === 'zh' }"
            @click="language = 'zh'"
          >
            <div class="option-main">
              <span class="option-name">简体中文</span>
              <span class="option-sub">Chinese Simplified</span>
            </div>
            <span v-if="language === 'zh'" class="check-mark"></span>
          </div>
          <div
            class="option-item"
            :class="{ selected: language === 'en' }"
            @click="language = 'en'"
          >
            <div class="option-main">
              <span class="option-name">English</span>
              <span class="option-sub">English</span>
            </div>
            <span v-if="language === 'en'" class="check-mark"></span>
          </div>
        </div>

        <div class="step-actions">
          <button class="secondary-btn" @click="prevStep">上一步</button>
          <button class="primary-btn" @click="handleNext">继续</button>
        </div>
      </div>

      <!-- API Key（Step 2） -->
      <div v-if="step === 2" class="step-content">
        <h2>配置 API Key</h2>
        <p class="step-desc">输入你的 DeepSeek API Key 以开始使用</p>

        <div class="form-group">
          <label class="form-label">API Key</label>
          <input
            v-model="apiKeyInput"
            type="password"
            class="form-input"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
            @keyup.enter="handleNext"
          />
          <p v-if="apiKeyError" class="form-error">{{ apiKeyError }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">API 地址（可选）</label>
          <input
            v-model="apiBaseUrlInput"
            class="form-input"
            placeholder="https://api.deepseek.com"
          />
        </div>

        <p class="form-hint">
          API Key 仅保存在本地，不会上传到任何服务器。
          <a href="https://platform.deepseek.com/" target="_blank">前往平台获取</a>
        </p>

        <div class="step-actions">
          <button class="secondary-btn" @click="prevStep">上一步</button>
          <button class="primary-btn" :disabled="!apiKeyInput.trim()" @click="handleNext">
            继续
          </button>
        </div>
      </div>

      <!-- 选择助手（Step 3） -->
      <div v-if="step === 3" class="step-content">
        <h2>选择默认助手</h2>
        <p class="step-desc">选择一个你最常用的助手作为默认</p>

        <div class="assistant-options">
          <div
            v-for="a in teamStore.presetAssistants"
            :key="a.id"
            class="assistant-option"
            :class="{ selected: selectedAssistant === a.id }"
            @click="selectAssistant(a.id)"
          >
            <div
              class="avatar"
              :style="{ backgroundColor: a.color + '20', color: a.color }"
            >
              {{ getInitial(a.name) }}
            </div>
            <div class="assistant-text">
              <h3 class="assistant-name">{{ a.name }}</h3>
              <p class="assistant-role">{{ a.role }}</p>
            </div>
            <span v-if="selectedAssistant === a.id" class="check-mark"></span>
          </div>
        </div>

        <div class="step-actions">
          <button class="secondary-btn" @click="prevStep">上一步</button>
          <button class="primary-btn" @click="handleNext">完成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboarding-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: 0 var(--space-8) var(--space-8);
}

.titlebar-drag {
  width: 100%;
  height: var(--titlebar-height);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.onboarding-container {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-track {
  width: 100%;
  height: 1px;
  background: var(--color-border-soft);
  border-radius: 1px;
  overflow: hidden;
  margin-bottom: var(--space-5);
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width var(--transition-slow) ease;
}

.step-dots {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-8);
}

.step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border);
  transition: all var(--transition-base);
}

.step-dot.active {
  background: var(--color-accent);
}

.step-dot.completed {
  background: var(--color-accent);
}

.step-content {
  width: 100%;
}

/* 欢迎页 */
.welcome-step {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) 0;
}

.logo-mark {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--color-accent-soft);
  margin-bottom: var(--space-6);
  position: relative;
}

.logo-mark::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--color-accent);
  border-radius: 4px;
}

.welcome-step h1 {
  font-size: var(--font-2xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-2);
  letter-spacing: 0.02em;
}

.subtitle {
  font-size: var(--font-md);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-6);
}

.desc {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  line-height: 1.7;
  margin-bottom: var(--space-8);
  max-width: 320px;
}

.footnote {
  margin-top: var(--space-5);
  font-size: var(--font-xs);
  color: var(--color-text-muted);
}

/* 通用 step 样式 */
.step-content h2 {
  font-size: var(--font-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-2);
}

.step-desc {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-6);
}

/* 选项列表 */
.option-list {
  margin-bottom: var(--space-6);
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.option-item:hover {
  border-color: var(--color-border);
  background: var(--color-bg-tertiary);
}

.option-item.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.option-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
}

.option-sub {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.check-mark {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  position: relative;
}

.check-mark::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 5px;
  width: 4px;
  height: 7px;
  border: solid var(--color-bg);
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

/* 表单 */
.form-group {
  margin-bottom: var(--space-4);
}

.form-label {
  display: block;
  font-size: var(--font-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.form-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  color: var(--color-text);
  outline: none;
  transition: all var(--transition-fast);
}

.form-input:focus {
  border-color: var(--color-accent);
}

.form-error {
  margin-top: var(--space-2);
  font-size: var(--font-xs);
  color: var(--color-error);
}

.form-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  line-height: 1.6;
  margin-bottom: var(--space-6);
}

.form-hint a {
  color: var(--color-accent);
}

/* 助手选项 */
.assistant-options {
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
  margin-bottom: var(--space-2);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.assistant-option:hover {
  border-color: var(--color-border);
  background: var(--color-bg-tertiary);
}

.assistant-option.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.assistant-text {
  flex: 1;
  min-width: 0;
}

.assistant-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  margin-bottom: 1px;
}

.assistant-role {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* 操作按钮 */
.step-actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.primary-btn {
  flex: 1;
  padding: var(--space-3) var(--space-5);
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: var(--font-medium);
  font-size: var(--font-sm);
  border-radius: var(--radius-md);
  text-align: center;
  transition: all var(--transition-fast);
}

.primary-btn:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.primary-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.secondary-btn {
  padding: var(--space-3) var(--space-5);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.secondary-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border-strong);
}
</style>
