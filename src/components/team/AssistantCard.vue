<script setup lang="ts">
import type { Assistant } from '@/types/assistant'

defineProps<{
  assistant: Assistant
}>()
</script>

<template>
  <div class="assistant-card" :style="{ '--assistant-color': assistant.color }">
    <div class="card-header">
      <div class="avatar">{{ assistant.avatar }}</div>
      <div class="name-section">
        <h3 class="name">{{ assistant.name }}</h3>
        <span class="role">{{ assistant.role }}</span>
      </div>
    </div>
    <p class="description">{{ assistant.description }}</p>
    <div class="card-footer">
      <span class="mode-tag">{{ 
        assistant.mode === 'standard' ? '标准' :
        assistant.mode === 'ptc' ? 'PTC' :
        assistant.mode === 'minimal' ? '极简' : '创造'
      }}</span>
      <span class="open-hint">点击开始 →</span>
    </div>
  </div>
</template>

<style scoped>
.assistant-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.assistant-card:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--assistant-color);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.name-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
}

.role {
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
}

.description {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  flex: 1;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-soft);
}

.mode-tag {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.open-hint {
  font-size: var(--font-xs);
  color: var(--assistant-color);
  opacity: 0;
  transform: translateX(-4px);
  transition: all var(--transition-fast);
}

.assistant-card:hover .open-hint {
  opacity: 1;
  transform: translateX(0);
}
</style>
