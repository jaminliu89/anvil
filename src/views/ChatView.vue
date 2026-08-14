<script setup lang="ts">
// MVP：ChatView 占位，后续接入 DSH Web UI 或自研对话
import { useRouter } from 'vue-router'
import { useTeamStore } from '@/stores/team'
import { computed } from 'vue'

const router = useRouter()
const teamStore = useTeamStore()

const assistant = computed(() => teamStore.currentAssistant)
</script>

<template>
  <div class="chat-view">
    <header class="chat-header">
      <button class="back-btn" @click="router.push('/')">← 返回</button>
      <div class="header-info">
        <h2>{{ assistant?.name || '助手' }}</h2>
        <span class="status-online">在线</span>
      </div>
    </header>
    <div class="chat-placeholder">
      <p class="placeholder-text">对话界面开发中…</p>
      <p class="placeholder-sub">下一版本接入 DSH Web UI</p>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
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

.header-info h2 {
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-online {
  font-size: var(--font-xs);
  color: var(--color-success);
  background: rgba(93, 163, 106, 0.1);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.chat-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.placeholder-text {
  font-size: var(--font-lg);
  color: var(--color-text-secondary);
}

.placeholder-sub {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
}
</style>
