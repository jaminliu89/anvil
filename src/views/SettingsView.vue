<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="settings-view">
    <header class="settings-header">
      <button class="back-btn" @click="router.push('/')">← 返回</button>
      <h2>设置</h2>
    </header>
    <div class="settings-body">
      <div class="setting-placeholder">
        <p>设置页开发中…</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.settings-header {
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

.settings-header h2 {
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
}

.settings-body {
  flex: 1;
  padding: var(--space-6);
}

.setting-placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-sm);
}
</style>
