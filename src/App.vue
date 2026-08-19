<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue'
import { useDshStore } from '@/stores/dsh'
import { useSettingsStore } from '@/stores/settings'
import TimelineView from '@/views/TimelineView.vue'
import ConnectView from '@/views/ConnectView.vue'
import TrainView from '@/views/TrainView.vue'
import GuardView from '@/views/GuardView.vue'
import SettingsView from '@/views/SettingsView.vue'
import RuntimeView from '@/views/RuntimeView.vue'
import Drawer from '@/components/Drawer.vue'

const dshStore = useDshStore()
const settingsStore = useSettingsStore()

// 抽屉状态: null 关闭, 否则是 drawer key
type DrawerKey = 'connect' | 'train' | 'guard' | 'settings' | 'runtime' | null
const activeDrawer = ref<DrawerKey>(null)

interface NavItem {
  id: string
  icon: string
  label: string
  drawer?: DrawerKey
  action?: () => void
}

const navItems: NavItem[] = [
  { id: 'timeline', icon: 'timeline', label: '时间线' },
  { id: 'connect', icon: 'link', label: '连接', drawer: 'connect' },
  { id: 'settings', icon: 'gear', label: '设置', drawer: 'settings' },
]

const advancedNav: NavItem[] = [
  { id: 'runtime', icon: 'play', label: '运行', drawer: 'runtime' },
  { id: 'train', icon: 'book', label: '训练', drawer: 'train' },
  { id: 'guard', icon: 'shield', label: '守卫', drawer: 'guard' },
]

const showAdvanced = computed(() => settingsStore.advancedMode)

function handleNavClick(item: NavItem) {
  if (item.id === 'timeline') {
    activeDrawer.value = null
    return
  }
  if (item.drawer) {
    // toggle: 点击同一个则关闭
    activeDrawer.value = activeDrawer.value === item.drawer ? null : item.drawer
  }
}

const isTimelineActive = computed(() => activeDrawer.value === null)

// 抽屉标题映射
const drawerTitles: Record<string, string> = {
  connect: '连接',
  runtime: '运行时',
  train: '训练',
  guard: '守卫',
  settings: '设置',
}

// 抽屉内容组件映射（懒加载性能不重要，数量少）
const drawerComponents: Record<string, ReturnType<typeof shallowRef>> = {
  connect: shallowRef(ConnectView),
  runtime: shallowRef(RuntimeView),
  train: shallowRef(TrainView),
  guard: shallowRef(GuardView),
  settings: shallowRef(SettingsView),
}

const currentDrawerComponent = computed(() => {
  if (!activeDrawer.value) return null
  return drawerComponents[activeDrawer.value]?.value || null
})

function statusLabel() {
  const s = dshStore.status
  if (s === 'running') return '就绪'
  if (s === 'starting') return '启动中'
  if (s === 'error') return '未就绪'
  return '待机'
}

onMounted(async () => {
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
        <button class="help-btn" aria-label="帮助">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
        <div class="status-badge" :class="dshStore.status">
          <span class="dot"></span>
          <span class="label">{{ statusLabel() }}</span>
        </div>
      </div>
    </header>

    <div class="body">
      <!-- 极窄图标栏 -->
      <nav class="iconbar">
        <div class="iconbar-items">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="icon-btn"
            :class="{ active: (item.id === 'timeline' && isTimelineActive) || (item.drawer && activeDrawer === item.drawer) }"
            :title="item.label"
            @click="handleNavClick(item)"
          >
            <svg v-if="item.icon === 'timeline'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <svg v-if="item.icon === 'list'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            <svg v-if="item.icon === 'link'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <svg v-if="item.icon === 'gear'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>

        <!-- 高级模式分隔 + 额外图标 -->
        <div v-if="showAdvanced" class="iconbar-divider"></div>
        <div v-if="showAdvanced" class="iconbar-items">
          <button
            v-for="item in advancedNav"
            :key="item.id"
            class="icon-btn"
            :class="{ active: item.drawer && activeDrawer === item.drawer }"
            :title="item.label"
            @click="handleNavClick(item)"
          >
            <svg v-if="item.icon === 'play'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg v-if="item.icon === 'book'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
            <svg v-if="item.icon === 'shield'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </button>
        </div>

        <div class="iconbar-footer">
          <button
            class="icon-btn mode-dot"
            :title="showAdvanced ? '高级模式' : '普通模式'"
            @click="settingsStore.toggleAdvanced(); settingsStore.save()"
          >
            <span class="mode-indicator" :class="{ advanced: showAdvanced }"></span>
          </button>
        </div>
      </nav>

      <!-- 主内容区：时间线 -->
      <main class="content">
        <TimelineView />
      </main>
    </div>

    <!-- 右侧抽屉 -->
    <Drawer
      v-if="activeDrawer"
      :open="!!activeDrawer"
      :title="drawerTitles[activeDrawer!]"
      :width="400"
      @close="activeDrawer = null"
    >
      <component :is="currentDrawerComponent" v-if="currentDrawerComponent" />
    </Drawer>
  </div>
</template>

<style scoped>
.app-shell { height: 100vh; display: flex; flex-direction: column; background: var(--canvas); }

.titlebar {
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 72px;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--line-subtle);
}
.titlebar-left { display: flex; align-items: center; }
.app-brand {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.titlebar-right { display: flex; align-items: center; gap: 8px; -webkit-app-region: no-drag; }

.help-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--ink3);
  cursor: pointer;
  border-radius: 6px;
  padding: 0;
}
.help-btn:hover {
  color: var(--ink);
  background: var(--muted);
}

.status-badge { display: flex; align-items: center; gap: 5px; padding: 2px 8px; height: 20px; font-size: 10px; color: var(--ink3); border-radius: var(--radius-sm); }
.status-badge .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.status-badge.running { color: var(--success); }
.status-badge.starting { color: var(--warning); }
.status-badge.error { color: var(--error); }
.status-badge.starting .dot { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.body { flex: 1; display: flex; overflow: hidden; }

/* 极窄图标栏 — 36px */
.iconbar {
  width: 36px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1px solid var(--line-subtle);
  background: var(--surface);
  padding: 8px 0;
  gap: 2px;
}
.iconbar-items { display: flex; flex-direction: column; gap: 2px; width: 100%; align-items: center; }
.iconbar-divider {
  width: 16px;
  height: 1px;
  background: var(--line);
  margin: 4px 0;
}
.iconbar-footer { margin-top: auto; width: 100%; display: flex; justify-content: center; }

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--ink3);
  cursor: pointer;
  border-radius: 6px;
  padding: 0;
  transition: all 120ms ease;
  flex-shrink: 0;
}
.icon-btn:hover {
  color: var(--ink);
  background: var(--muted);
}
.icon-btn.active {
  color: var(--signal);
  background: var(--signalSoft);
}

.mode-dot {
  width: 28px;
  height: 28px;
}
.mode-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line);
  display: block;
}
.mode-indicator.advanced {
  background: var(--ink);
}

.content { flex: 1; overflow: hidden; background: var(--canvas); display: flex; flex-direction: column; }
.content > :deep(*) { flex: 1; }
</style>
