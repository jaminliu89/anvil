<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useTeamStore } from '@/stores/team'
import AssistantCard from '@/components/team/AssistantCard.vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const teamStore = useTeamStore()

const currentStep = ref(1)
const totalSteps = 3

const progressPercent = computed(() => (currentStep.value / totalSteps) * 100)

// === 步骤 1：语言 ===
function selectLanguage(lang: 'zh' | 'en') {
  settingsStore.language = lang
  goToStep(2)
}

// === 步骤 2：API key ===
const apiKeyInput = ref('')
const apiKeyError = ref('')
const apiBaseUrlInput = ref('https://api.deepseek.com')

function validateAndNext() {
  const err = settingsStore.validateApiKey(apiKeyInput.value)
  if (err) {
    apiKeyError.value = err
    return
  }
  apiKeyError.value = ''
  settingsStore.apiKey = apiKeyInput.value.trim()
  if (apiBaseUrlInput.value.trim()) {
    settingsStore.apiBaseUrl = apiBaseUrlInput.value.trim()
  }
  goToStep(3)
}

// === 步骤 3：选择默认助手 ===
function selectAssistant(id: string) {
  settingsStore.defaultAssistantId = id
  finishOnboarding()
}

// === 导航 ===
function goToStep(step: number) {
  currentStep.value = step
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

async function finishOnboarding() {
  settingsStore.onboardingCompleted = true
  await settingsStore.save()
  router.push('/')
}

onMounted(async () => {
  await settingsStore.load()
  // 已经引导过的直接跳首页
  if (settingsStore.onboardingCompleted) {
    router.push('/')
  }
})
</script>

<template>
  <div class="onboarding">
    <!-- 顶部进度条 -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
    </div>

    <div class="onboarding-container">
      <!-- 步骤 1：语言 -->
      <div v-if="currentStep === 1" class="step">
        <div class="step-icon">🌐</div>
        <h1>选择语言</h1>
        <p class="step-desc">选择你习惯使用的语言</p>
        <div class="lang-options">
          <button class="lang-btn" @click="selectLanguage('zh')">
            <span class="lang-name">简体中文</span>
            <span class="lang-sub">推荐</span>
          </button>
          <button class="lang-btn" @click="selectLanguage('en')">
            <span class="lang-name">English</span>
            <span class="lang-sub"></span>
          </button>
        </div>
      </div>

      <!-- 步骤 2：API key -->
      <div v-if="currentStep === 2" class="step">
        <div class="step-icon">🔑</div>
        <h1>配置 API Key</h1>
        <p class="step-desc">输入你的 DeepSeek API key，数据只存在你电脑上</p>

        <div class="form-group">
          <label>API Key</label>
          <input
            v-model="apiKeyInput"
            type="password"
            class="input"
            placeholder="sk- 或 ds- 开头"
            @keyup.enter="validateAndNext"
          />
          <p v-if="apiKeyError" class="error-text">{{ apiKeyError }}</p>
          <p class="hint">
            从
            <a href="https://platform.deepseek.com/api_keys" target="_blank">
              DeepSeek 平台
            </a>
            获取，我们只在本地使用，不会上传
          </p>
        </div>

        <div class="form-group">
          <label class="optional">API 地址（可选）</label>
          <input
            v-model="apiBaseUrlInput"
            type="text"
            class="input"
            placeholder="https://api.deepseek.com"
          />
        </div>

        <div class="step-actions">
          <button class="btn-secondary" @click="prevStep">上一步</button>
          <button class="btn-primary" @click="validateAndNext">下一步</button>
        </div>
      </div>

      <!-- 步骤 3：选择默认助手 -->
      <div v-if="currentStep === 3" class="step">
        <div class="step-icon">👥</div>
        <h1>选择你的主力助手</h1>
        <p class="step-desc">先选一个你最常用的，以后随时可以换</p>

        <div class="assistant-grid">
          <AssistantCard
            v-for="a in teamStore.assistants"
            :key="a.id"
            :assistant="a"
            @click="selectAssistant(a.id)"
          />
        </div>

        <div class="step-actions single">
          <button class="btn-ghost" @click="prevStep">上一步</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.progress-bar {
  height: 2px;
  background: var(--color-bg-tertiary);
  flex-shrink: 0;
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.onboarding-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  overflow-y: auto;
}

.step {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  text-align: center;
}

.step-icon {
  font-size: 48px;
  margin-bottom: var(--space-2);
}

.step h1 {
  font-size: var(--font-2xl);
  font-weight: var(--font-semibold);
}

.step-desc {
  font-size: var(--font-md);
  color: var(--color-text-secondary);
  margin-top: calc(var(--space-2) * -1);
}

.lang-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  margin-top: var(--space-4);
}

.lang-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  font-size: var(--font-md);
  transition: all var(--transition-fast);
  text-align: left;
}

.lang-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-accent);
}

.lang-name {
  font-weight: var(--font-medium);
}

.lang-sub {
  font-size: var(--font-sm);
  color: var(--color-accent);
}

.form-group {
  width: 100%;
  text-align: left;
  margin-bottom: var(--space-2);
}

.form-group label {
  display: block;
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-2);
  color: var(--color-text);
}

.form-group label.optional {
  color: var(--color-text-secondary);
}

.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-base);
  color: var(--color-text);
  transition: all var(--transition-fast);
  user-select: text;
}

.input:focus {
  border-color: var(--color-accent);
  outline: none;
}

.error-text {
  font-size: var(--font-sm);
  color: var(--color-error);
  margin-top: var(--space-2);
}

.hint {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-2);
  line-height: 1.5;
}

.hint a {
  color: var(--color-accent);
}

.step-actions {
  display: flex;
  gap: var(--space-3);
  width: 100%;
  margin-top: var(--space-4);
}

.step-actions.single {
  justify-content: center;
}

.btn-primary {
  flex: 1;
  padding: var(--space-3) var(--space-6);
  background: var(--color-accent);
  color: #1a1a1a;
  font-weight: var(--font-semibold);
  border-radius: var(--radius-md);
  font-size: var(--font-md);
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}

.btn-secondary {
  padding: var(--space-3) var(--space-6);
  background: var(--color-bg-tertiary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-md);
  transition: all var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-border-strong);
}

.btn-ghost {
  padding: var(--space-3) var(--space-6);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.btn-ghost:hover {
  color: var(--color-text);
  background: var(--color-bg-tertiary);
}

.assistant-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  width: 100%;
  margin-top: var(--space-2);
}
</style>
