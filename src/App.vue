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
  { id: 'chat', label: '对话', icon: 'chat' },
  { id: 'runtime', label: 'AI 引擎', icon: 'play' },
  { id: 'train', label: '训练', icon: 'book', advanced: true },
  { id: 'connect', label: '连接', icon: 'link', advanced: true },
  { id: 'guard', label: '守卫', icon: 'shield', advanced: true },
  { id: 'settings', label: '设置', icon: 'gear' },
]

const advanced = computed(() => settingsStore.advancedMode)
const navItems = computed(() => allNav.filter((n) => !n.advanced || advanced.value))

const activeTab = ref('chat')

function syncTab() {
  const path = route.path.split('/')[1] || 'chat'
  activeTab.value = path
}

function navigate(id: string) {
  activeTab.value = id
  router.push(id === 'chat' ? '/' : `/${id}`)
}

function statusLabel() {
  const s = dshStore.status
  if (s === 'running') return '引擎就绪'
  if (s === 'starting') return '启动中'
  if (s === 'error') return '服务未就绪'
  return '引擎待机'
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
    <!-- Titlebar (macOS native window drag region) -->
    <header class="titlebar" data-tauri-drag-region>
      <div class="titlebar-left" data-tauri-drag-region>
        <span class="app-brand">Anvil</span>
        <span class="app-version">v0.1.0</span>
      </div>
      <div class="titlebar-right">
        <div class="status-badge" :class="dshStore.status">
          <span class="dot"></span>
          <span class="label">{{ statusLabel() }}</span>
        </div>
      </div>
    </header>

    <div class="body">
      <!-- Parchment Sidebar -->
      <nav class="sidebar">
        <div class="brand">
          <div class="brand-icon">A</div>
          <div class="brand-info">
            <span class="brand-text">Anvil</span>
            <span class="brand-sub">本地 AI 工作站</span>
          </div>
        </div>

        <div class="nav-list">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="nav-btn"
            :class="{ active: activeTab === item.id }"
            @click="navigate(item.id)"
          >
            <svg v-if="item.icon === 'chat'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <svg v-if="item.icon === 'play'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg v-if="item.icon === 'book'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
            <svg v-if="item.icon === 'link'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <svg v-if="item.icon === 'shield'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <svg v-if="item.icon === 'gear'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span class="nav-label">{{ item.label }}</span>
          </button>
        </div>

        <div class="sidebar-footer">
          <div class="engine-status">
            <span class="status-dot" :class="dshStore.status === 'running' ? 'on' : 'off'"></span>
            <span class="status-text">{{ dshStore.status === 'running' ? '大脑在线' : '大脑离线' }}</span>
          </div>
          <button class="mode-toggle" @click="settingsStore.toggleAdvanced(); settingsStore.save()">
            {{ advanced ? '切换普通模式' : '切换高级模式' }}
          </button>
        </div>
      </nav>

      <!-- Main View Container -->
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--canvas);
  color: var(--ink);
}

.titlebar {
  height: var(--titlebar-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4) 0 78px;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.app-brand {
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  color: var(--signal);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-version {
  font-size: 10px;
  color: var(--ink4);
}

.titlebar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  -webkit-app-region: no-drag;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  height: 22px;
  font-size: 11px;
  color: var(--ink3);
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.status-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-badge.running { color: var(--success); }
.status-badge.starting { color: var(--warning); }
.status-badge.error { color: var(--error); }

.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--line);
  padding: var(--space-4) var(--space-3);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-2) var(--space-4) var(--space-2);
  border-bottom: 1px solid var(--line);
  margin-bottom: var(--space-4);
}

.brand-icon {
  width: 32px;
  height: 32px;
  background: var(--signal);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--raised);
  font-weight: var(--font-bold);
  font-size: var(--font-md);
  flex-shrink: 0;
}

.brand-info {
  display: flex;
  flex-direction: column;
}

.brand-text {
  font-size: var(--font-md);
  font-weight: var(--font-bold);
  color: var(--ink);
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.brand-sub {
  font-size: 11px;
  color: var(--ink3);
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--ink3);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
  background: none;
  width: 100%;
}

.nav-btn:hover {
  background: var(--signal-soft);
  color: var(--ink);
}

.nav-btn.active {
  background: var(--signal);
  color: var(--raised);
}

.sidebar-footer {
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.engine-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--space-1) var(--space-2);
  font-size: 12px;
  color: var(--ink3);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.on { background: var(--success); }
.status-dot.off { background: var(--ink4); }

.mode-toggle {
  width: 100%;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--raised);
  color: var(--ink3);
  font-size: 11px;
  font-weight: var(--font-medium);
  cursor: pointer;
  text-align: center;
  transition: all var(--transition-fast);
}

.mode-toggle:hover {
  color: var(--ink2);
  border-color: var(--signal);
}

.content {
  flex: 1;
  overflow-y: auto;
  background: var(--canvas);
  display: flex;
  flex-direction: column;
}

.content > :deep(*) {
  flex: 1;
}
</style>
