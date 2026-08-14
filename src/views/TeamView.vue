<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeamStore } from '@/stores/team'
import { useDshStore } from '@/stores/dsh'
import { useSettingsStore } from '@/stores/settings'
import AssistantEditor from '@/components/team/AssistantEditor.vue'
import type { Assistant } from '@/types/assistant'
import { startDsh } from '@/services/dsh'

const router = useRouter()
const teamStore = useTeamStore()
const dshStore = useDshStore()
const settingsStore = useSettingsStore()

const showEditor = ref(false)
const editingAssistant = ref<Assistant | null>(null)

onMounted(async () => {
  await Promise.all([
    teamStore.load(),
    settingsStore.load(),
  ])
  if (dshStore.status === 'idle') {
    startDsh().catch(() => {})
  }
})

function openChat(assistant: Assistant) {
  teamStore.setCurrentAssistant(assistant.id)
  router.push(`/chat/${assistant.id}`)
}

function openNewAssistant() {
  editingAssistant.value = null
  showEditor.value = true
}

function openEditAssistant(assistant: Assistant) {
  if (!assistant.isCustom) return
  editingAssistant.value = assistant
  showEditor.value = true
}

async function handleSave(data: Partial<Assistant>) {
  if (editingAssistant.value) {
    await teamStore.updateAssistant(editingAssistant.value.id, data)
  } else {
    await teamStore.addAssistant(data as Assistant)
  }
  showEditor.value = false
}

async function handleDelete(id: string) {
  await teamStore.deleteAssistant(id)
  showEditor.value = false
}

function openSettings() {
  router.push('/settings')
}

const statusLabel = () => {
  const s = dshStore.status
  if (s === 'running') return '就绪'
  if (s === 'starting') return '启动中'
  if (s === 'error') return '异常'
  return '待机'
}
</script>

<template>
  <div class="view">
    <!-- 标题栏 -->
    <header class="titlebar" data-tauri-drag-region>
      <div class="titlebar-left" data-tauri-drag-region>
        <span class="app-name">鲸团</span>
      </div>
      <div class="titlebar-center" data-tauri-drag-region></div>
      <div class="titlebar-right">
        <div class="status" :class="dshStore.status">
          <span class="dot"></span>
          <span class="label">{{ statusLabel() }}</span>
        </div>
        <button class="bar-btn" @click="openSettings" title="设置">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </header>

    <!-- 主体 -->
    <main class="main">
      <div class="hero">
        <div class="hero-mark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="6" height="6" rx="1.5"></rect>
            <rect x="14" y="4" width="6" height="6" rx="1.5"></rect>
            <rect x="4" y="14" width="6" height="6" rx="1.5"></rect>
            <rect x="14" y="14" width="6" height="6" rx="1.5"></rect>
          </svg>
        </div>
        <h1 class="hero-title">选一位助手开始</h1>
        <p class="hero-sub">四个各有所长的 AI 同事，随时待命</p>
      </div>

      <!-- 预设助手 -->
      <div class="grid">
        <button
          v-for="a in teamStore.presetAssistants"
          :key="a.id"
          class="card"
          @click="openChat(a)"
        >
          <div class="card-top">
            <div class="avatar" :style="{ backgroundColor: a.color + '15', color: a.color }">
              {{ a.name.charAt(0) }}
            </div>
            <div class="card-name">
              <h2>{{ a.name }}</h2>
              <span>{{ a.role }}</span>
            </div>
          </div>
          <p class="card-desc">{{ a.description }}</p>
          <div class="card-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>
        </button>
      </div>

      <!-- 我的助手 -->
      <div v-if="teamStore.customAssistants.length > 0" class="section">
        <div class="section-head">
          <span class="section-title">我的助手</span>
          <button class="text-btn" @click="openNewAssistant">新建</button>
        </div>
        <div class="list">
          <div
            v-for="a in teamStore.customAssistants"
            :key="a.id"
            class="list-item"
            @click="openChat(a)"
          >
            <div class="item-avatar" :style="{ backgroundColor: a.color + '15', color: a.color }">
              {{ a.name.charAt(0) }}
            </div>
            <div class="item-body">
              <span class="item-name">{{ a.name }}</span>
              <span class="item-role">{{ a.role }}</span>
            </div>
            <button class="item-edit" @click.stop="openEditAssistant(a)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-row">
        <button class="ghost-btn" @click="openNewAssistant">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          创建你的第一个助手
        </button>
      </div>
    </main>

    <AssistantEditor
      :visible="showEditor"
      :assistant="editingAssistant"
      @close="showEditor = false"
      @save="handleSave"
      @delete="handleDelete"
    />
  </div>
</template>

<style scoped>
.view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

/* 标题栏 */
.titlebar {
  height: var(--titlebar-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  -webkit-app-region: drag;
}

.titlebar-left {
  flex: 1;
  padding-left: 72px;
  display: flex;
  align-items: center;
}

.app-name {
  font-size: var(--font-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-tertiary);
  letter-spacing: 0.02em;
}

.titlebar-center {
  flex: 1;
}

.titlebar-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-2);
  -webkit-app-region: no-drag;
}

.status {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  height: 20px;
  font-size: 10px;
  color: var(--color-text-tertiary);
}

.status .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.status.running { color: var(--color-success); }
.status.starting { color: var(--color-warning); }
.status.error { color: var(--color-error); }

.status.starting .dot {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.bar-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.bar-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-tertiary);
}

/* 主体 */
.main {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-12) var(--space-10);
}

.hero {
  text-align: center;
  margin-bottom: var(--space-10);
}

.hero-mark {
  width: 36px;
  height: 36px;
  margin: 0 auto var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-signal-soft);
  color: var(--color-signal);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-title {
  font-size: var(--font-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-2);
  letter-spacing: -0.01em;
}

.hero-sub {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
}

/* 卡片网格 */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  width: 100%;
  max-width: 520px;
  margin-bottom: var(--space-10);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-base);
  position: relative;
  font-family: inherit;
  color: inherit;
}

.card:hover {
  border-color: var(--color-border);
  background: var(--color-bg-tertiary);
  transform: translateY(-1px);
}

.card:active {
  transform: translateY(0);
}

.card-top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.card-name {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.card-name h2 {
  font-size: var(--font-md);
  font-weight: var(--font-medium);
  line-height: 1.2;
}

.card-name span {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}

.card-desc {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-arrow {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  color: var(--color-text-muted);
  opacity: 0;
  transform: translateX(-4px);
  transition: all var(--transition-base);
}

.card:hover .card-arrow {
  opacity: 1;
  transform: translateX(0);
  color: var(--color-text-tertiary);
}

/* 分区 */
.section {
  width: 100%;
  max-width: 520px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.section-title {
  font-size: var(--font-2xs);
  font-weight: var(--font-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.text-btn {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.text-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-tertiary);
}

/* 列表 */
.list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.list-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: all var(--transition-fast);
  border-bottom: 1px solid var(--color-border-soft);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:hover {
  background: var(--color-bg-tertiary);
}

.item-avatar {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
}

.item-role {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}

.item-edit {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  border-radius: 4px;
  opacity: 0;
  transition: all var(--transition-fast);
}

.list-item:hover .item-edit {
  opacity: 1;
}

.item-edit:hover {
  color: var(--color-text);
  background: var(--color-bg-elevated);
}

/* 空状态 */
.empty-row {
  width: 100%;
  max-width: 520px;
  display: flex;
  justify-content: center;
}

.ghost-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.ghost-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border-strong);
  background: var(--color-bg-secondary);
}
</style>
