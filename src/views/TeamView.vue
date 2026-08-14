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

function openEditAssistant(assistant: Assistant, e: Event) {
  e.stopPropagation()
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
</script>

<template>
  <div class="team-view">
    <!-- 标题栏（拖拽区 + 交通灯空间） -->
    <header class="titlebar" data-tauri-drag-region>
      <div class="titlebar-left" data-tauri-drag-region>
        <span class="title">鲸团</span>
      </div>
      <div class="titlebar-center" data-tauri-drag-region>
        <span class="center-title">我的团队</span>
      </div>
      <div class="titlebar-right">
        <span class="status-dot" :class="dshStore.status"></span>
      </div>
    </header>

    <!-- 主体 -->
    <div class="main">
      <div class="sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">助手</h2>
          <button class="icon-btn" @click="openNewAssistant" title="新建助手">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <div class="assistant-list">
          <div
            v-for="a in teamStore.presetAssistants"
            :key="a.id"
            class="assistant-item"
            @click="openChat(a)"
          >
            <div class="item-avatar" :style="{ backgroundColor: a.color + '18', color: a.color }">
              {{ a.name.charAt(0) }}
            </div>
            <div class="item-info">
              <span class="item-name">{{ a.name }}</span>
              <span class="item-role">{{ a.role }}</span>
            </div>
          </div>

          <div v-if="teamStore.customAssistants.length > 0" class="list-divider">
            <span>我的</span>
          </div>

          <div
            v-for="a in teamStore.customAssistants"
            :key="a.id"
            class="assistant-item"
            @click="openChat(a)"
            @contextmenu.prevent="openEditAssistant(a, $event)"
          >
            <div class="item-avatar" :style="{ backgroundColor: a.color + '18', color: a.color }">
              {{ a.name.charAt(0) }}
            </div>
            <div class="item-info">
              <span class="item-name">{{ a.name }}</span>
              <span class="item-role">{{ a.role }}</span>
            </div>
            <button class="item-edit" @click="openEditAssistant(a, $event)" title="编辑">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="sidebar-footer">
          <button class="footer-item" @click="openSettings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>设置</span>
          </button>
        </div>
      </div>

      <!-- 右侧内容：欢迎 / 助手详情 -->
      <div class="content">
        <div class="welcome">
          <div class="welcome-mark"></div>
          <h1 class="welcome-title">选择一位助手开始</h1>
          <p class="welcome-desc">
            从左侧选择一位 AI 助手，立即开始对话。
            每个助手都有不同的专长，各司其职。
          </p>
          <div class="welcome-grid">
            <div
              v-for="a in teamStore.presetAssistants"
              :key="a.id"
              class="welcome-card"
              @click="openChat(a)"
            >
              <div class="card-avatar" :style="{ backgroundColor: a.color + '18', color: a.color }">
                {{ a.name.charAt(0) }}
              </div>
              <h3>{{ a.name }}</h3>
              <p>{{ a.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
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
.team-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

/* 标题栏 */
.titlebar {
  height: var(--titlebar-height);
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
  background: var(--color-bg);
  -webkit-app-region: drag;
}

.titlebar-left {
  display: flex;
  align-items: center;
  padding-left: 72px; /* 避开交通灯 */
}

.title {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-tertiary);
}

.titlebar-center {
  display: flex;
  justify-content: center;
}

.center-title {
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.titlebar-right {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  -webkit-app-region: no-drag;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.status-dot.running {
  background: var(--color-success);
}

.status-dot.starting {
  background: var(--color-warning);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-dot.error {
  background: var(--color-error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 主体 */
.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧边栏 */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border-soft);
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-3) var(--space-2);
}

.sidebar-title {
  font-size: var(--font-2xs);
  font-weight: var(--font-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-left: var(--space-2);
}

.icon-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-tertiary);
}

/* 助手列表 */
.assistant-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-2) var(--space-2);
}

.assistant-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: 1px;
}

.assistant-item:hover {
  background: var(--color-bg-tertiary);
}

.item-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-role {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.assistant-item:hover .item-edit {
  opacity: 1;
}

.item-edit:hover {
  color: var(--color-text);
  background: var(--color-bg-elevated);
}

.list-divider {
  padding: var(--space-3) var(--space-2) var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.list-divider::before,
.list-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--color-border-soft);
}

.list-divider span {
  font-size: 9px;
  font-weight: var(--font-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* 侧栏底部 */
.sidebar-footer {
  border-top: 1px solid var(--color-border-soft);
  padding: var(--space-2);
}

.footer-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  width: 100%;
  transition: all var(--transition-fast);
}

.footer-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
}

/* 右侧内容 */
.content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-10);
}

.welcome {
  max-width: 640px;
  width: 100%;
  text-align: center;
}

.welcome-mark {
  width: 40px;
  height: 40px;
  margin: 0 auto var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-signal-soft);
  position: relative;
}

.welcome-mark::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--color-signal);
  border-radius: 3px;
}

.welcome-title {
  font-size: var(--font-2xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-3);
}

.welcome-desc {
  font-size: var(--font-md);
  color: var(--color-text-tertiary);
  line-height: 1.7;
  margin-bottom: var(--space-8);
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.welcome-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  text-align: left;
}

.welcome-card {
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
}

.welcome-card:hover {
  border-color: var(--color-border);
  background: var(--color-bg-tertiary);
  transform: translateY(-1px);
}

.card-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-3);
}

.welcome-card h3 {
  font-size: var(--font-md);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-2);
}

.welcome-card p {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
