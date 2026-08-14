<script setup lang="ts">
// MVP 占位：首启动引导
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="onboarding-view">
    <div class="onboarding-content">
      <h1>欢迎来到鲸团</h1>
      <p class="subtitle">你的第一个 AI 助手团队</p>
      <button class="start-btn" @click="router.push('/')">
        开始使用
      </button>
    </div>
  </div>
</template>

<style scoped>
.onboarding-view {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
}

.onboarding-content {
  text-align: center;
}

h1 {
  font-size: var(--font-3xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-3);
}

.subtitle {
  font-size: var(--font-md);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-8);
}

.start-btn {
  padding: var(--space-3) var(--space-8);
  background: var(--color-accent);
  color: #1a1a1a;
  font-weight: var(--font-semibold);
  border-radius: var(--radius-md);
  font-size: var(--font-md);
  transition: all var(--transition-fast);
}

.start-btn:hover {
  background: var(--color-accent-hover);
}
</style>
