<script setup lang="ts">
import { computed } from 'vue'
import type { Assistant } from '@/types/assistant'

const props = defineProps<{
  assistant: Assistant
}>()

defineEmits<{
  click: []
}>()

// 取名字第一个字作为头像文字
const initial = computed(() => props.assistant.name.charAt(0))
</script>

<template>
  <div class="assistant-card" @click="$emit('click')">
    <div class="card-header">
      <div class="avatar" :style="{ backgroundColor: assistant.color + '20', color: assistant.color }">
        {{ initial }}
      </div>
      <div class="card-title">
        <h3>{{ assistant.name }}</h3>
        <span class="role">{{ assistant.role }}</span>
      </div>
    </div>
    <p class="desc">{{ assistant.description }}</p>
    <div class="card-footer">
      <span v-if="assistant.isCustom" class="custom-tag">自定义</span>
      <span v-else class="preset-tag">预设</span>
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
  gap: var(--space-3);
  position: relative;
}

.assistant-card:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
  transform: translateY(-1px);
}

.assistant-card:active {
  transform: translateY(0);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
  letter-spacing: 0;
}

.card-title {
  flex: 1;
  min-width: 0;
}

.card-title h3 {
  font-size: var(--font-md);
  font-weight: var(--font-medium);
  color: var(--color-text);
  margin-bottom: 2px;
}

.role {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
}

.desc {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  margin-top: auto;
  padding-top: var(--space-1);
}

.preset-tag,
.custom-tag {
  font-size: 10px;
  font-weight: var(--font-medium);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  letter-spacing: 0.02em;
}

.preset-tag {
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-soft);
}

.custom-tag {
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border: 1px solid transparent;
}
</style>
