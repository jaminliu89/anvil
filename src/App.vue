<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settingsStore = useSettingsStore()

const pageLabel = computed(() => route.path === '/' ? '任务' : '设置')

onMounted(async () => {
  await settingsStore.load()
})
</script>

<template>
  <div class="app-shell">
    <header class="titlebar" data-tauri-drag-region>
      <div class="titlebar-left" data-tauri-drag-region>
        <span class="app-brand">Anvil</span>
        <span class="page-label">{{ pageLabel }}</span>
      </div>
      <div class="titlebar-right">
        <span class="product-status">Rescue · VS-001</span>
      </div>
    </header>

    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell { height: 100vh; display: flex; flex-direction: column; background: var(--color-bg); }
.titlebar {
  height: var(--titlebar-height); flex-shrink: 0; display: flex; align-items: center;
  justify-content: space-between; padding: 0 var(--space-4) 0 72px;
  -webkit-app-region: drag; border-bottom: 1px solid var(--color-border-soft);
}
.titlebar-left { display: flex; align-items: center; gap: 10px; }
.app-brand { font-size: var(--font-xs); font-weight: var(--font-semibold); color: var(--color-signal); letter-spacing: .06em; text-transform: uppercase; }
.page-label { font-size: 11px; color: var(--color-text-tertiary); }
.titlebar-right { -webkit-app-region: no-drag; }
.product-status { font-size: 10px; color: var(--color-text-tertiary); }
.content { flex: 1; min-height: 0; overflow-y: auto; background: var(--color-bg); display: flex; flex-direction: column; }
.content > :deep(*) { flex: 1; }
</style>
