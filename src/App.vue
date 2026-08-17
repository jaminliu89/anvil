<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDshStore } from '@/stores/dsh'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const route = useRoute()
const dshStore = useDshStore()
const settingsStore = useSettingsStore()

interface NavItem { id: string; label: string; icon: string; advanced?: boolean }

const allNav: NavItem[] = [
  { id: 'timeline', label: '时间线', icon: 'timeline' },
  { id: 'chat', label: '对话', icon: 'chat' },
  { id: 'runtime', label: '运行', icon: 'play' },
  { id: 'train', label: '训练', icon: 'book', advanced: true },
  { id: 'connect', label: '连接', icon: 'link', advanced: true },
  { id: 'guard', label: '守卫', icon: 'shield', advanced: true },
  { id: 'settings', label: '设置', icon: 'gear' },
]

const advanced = computed(() => settingsStore.advancedMode)
const navItems = computed(() => allNav.filter((n) => !n.advanced || advanced.value))

const activeTab = ref('timeline')

function syncTab() {
  const path = route.path.split('/')[1] || 'timeline'
  activeTab.value = path
}

function navigate(id: string) {
  activeTab.value = id
  router.push(id === 'timeline' ? '/' : `/${id}`)
}

function statusLabel() {
  const s = dshStore.status
  if (s === 'running') return '就绪'
  if (s === 'starting') return '启动中'
  if (s === 'error') return '未就绪'
  return '待机'
}

onMounted(async () => {
  syncTab()
  await settingsStore.load()
  dshStore.setupEvents()
  dshStore.refresh()
})
</script>

<template>
  <div class="app-shell">
    <header class="titlebar" data-tauri-drag-region>
      <div class="titlebar-left" data-tauri-drag-region>
        <span class="app-brand">Anvil</span>
      </div>
      <div class="titlebar-right">
        <div class="status-badge" :class="dshStore.status">
          <span class="dot"></span>
          <span class="label">{{ statusLabel() }}</span>
        </div>
      </div>
    </header>

    <div class="body">
      <nav class="sidebar">
        <div class="sidebar-items">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="nav-item"
            :class="{ active: activeTab === item.id }"
            @click="navigate(item.id)"
          >
            <svg v-if="item.icon === 'timeline'" class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <svg v-if="item.icon === 'chat'" class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <svg v-if="item.icon === 'play'" class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg v-if="item.icon === 'book'" class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
            <svg v-if="item.icon === 'link'" class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <svg v-if="item.icon === 'shield'" class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <svg v-if="item.icon === 'gear'" class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span class="nav-label">{{ item.label }}</span>
          </button>
        </div>

        <div class="sidebar-footer">
          <button class="mode-toggle" @click="settingsStore.toggleAdvanced(); settingsStore.save()">
            {{ advanced ? '普通模式' : '高级模式' }}
          </button>
        </div>
      </nav>

      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell { height: 100vh; display: flex; flex-direction: column; background: var(--color-bg); }

.titlebar {
  height: var(--titlebar-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4) 0 72px;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--color-border-soft);
}
.titlebar-left { display: flex; align-items: center; gap: var(--space-3); }
.app-brand { font-size: var(--font-xs); font-weight: var(--font-semibold); color: var(--color-signal); letter-spacing: 0.06em; text-transform: uppercase; }
.titlebar-right { display: flex; align-items: center; gap: var(--space-2); -webkit-app-region: no-drag; }

.status-badge { display: flex; align-items: center; gap: 5px; padding: 2px 8px; height: 20px; font-size: 10px; color: var(--color-text-tertiary); border-radius: var(--radius-sm); }
.status-badge .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.status-badge.running { color: var(--color-success); }
.status-badge.starting { color: var(--color-warning); }
.status-badge.error { color: var(--color-error); }
.status-badge.starting .dot { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.body { flex: 1; display: flex; overflow: hidden; }

.sidebar {
  width: 180px; flex-shrink: 0; display: flex; flex-direction: column;
  border-right: 1px solid var(--color-border-soft);
  background: var(--color-bg-secondary);
  padding: var(--space-2) var(--space-2);
}
.sidebar-items { display: flex; flex-direction: column; gap: 2px; }

.nav-item {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm);
  color: var(--color-text-tertiary); font-size: var(--font-xs); font-family: inherit;
  cursor: pointer; transition: all var(--transition-fast);
  border: none; background: none; width: 100%; text-align: left; height: 32px;
}
.nav-item:hover { color: var(--color-text-secondary); background: var(--color-bg-tertiary); }
.nav-item.active { color: var(--color-signal); background: var(--color-signal-soft); }
.nav-icon { flex-shrink: 0; }
.nav-label { line-height: 1; }

.sidebar-footer { margin-top: auto; padding: var(--space-2); }
.mode-toggle {
  width: 100%; padding: 6px 8px; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-soft); background: none;
  color: var(--color-text-tertiary); font-size: 11px; font-family: inherit; cursor: pointer;
  transition: all var(--transition-fast);
}
.mode-toggle:hover { color: var(--color-text-secondary); border-color: var(--color-border); }

.content { flex: 1; overflow-y: auto; background: var(--color-bg); display: flex; flex-direction: column; }
.content > :deep(*) { flex: 1; }
</style>