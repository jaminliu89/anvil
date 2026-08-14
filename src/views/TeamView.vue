<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeamStore } from '@/stores/team'
import { useDshStore } from '@/stores/dsh'
import { useSettingsStore } from '@/stores/settings'
import AssistantCard from '@/components/team/AssistantCard.vue'
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
    <!-- 顶部栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <h1>鲸团</h1>
      </div>
      <div class="topbar-right">
        <div class="status-pill" :class="dshStore.status">
          <span class="dot"></span>
          <span class="label">
            {{ dshStore.status === 'running' ? '就绪' :
               dshStore.status === 'starting' ? '启动中' :
               dshStore.status === 'error' ? '异常' : '待机' }}
          </span>
        </div>
        <button class="icon-btn" @click="openSettings" title="设置">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </header>

    <!-- 内容区 -->
    <div class="content">
      <!-- 预设助手 -->
      <section class="section">
        <div class="section-header">
          <h2>预设助手</h2>
          <span class="section-count">{{ teamStore.presetAssistants.length }}</span>
        </div>
        <div class="card-grid">
          <AssistantCard
            v-for="a in teamStore.presetAssistants"
            :key="a.id"
            :assistant="a"
            @click="openChat(a)"
          />
        </div>
      </section>

      <!-- 我的助手 -->
      <section class="section">
        <div class="section-header">
          <div class="section-title-row">
            <h2>我的助手</h2>
            <button class="new-btn" @click="openNewAssistant">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              新建
            </button>
          </div>
          <span class="section-count">{{ teamStore.customAssistants.length }}</span>
        </div>

        <div v-if="teamStore.customAssistants.length > 0" class="card-grid">
          <AssistantCard
            v-for="a in teamStore.customAssistants"
            :key="a.id"
            :assistant="a"
            @click="openChat(a)"
          >
            <button class="edit-dot" @click="openEditAssistant(a, $event)" title="编辑"></button>
          </AssistantCard>
        </div>

        <div v-else class="empty-row">
          <p class="empty-text">还没有自定义助手</p>
          <button class="link-btn" @click="openNewAssistant">创建第一个</button>
        </div>
      </section>
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

/* 顶部栏 */
.topbar {
  height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-5);
  border-bottom: 1px solid var(--color-border-soft);
  background: var(--color-bg);
}

.topbar-left h1 {
  font-size: var(--font-md);
  font-weight: var(--font-medium);
  letter-spacing: 0.01em;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
}

.status-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-pill.running {
  color: var(--color-success);
}

.status-pill.starting {
  color: var(--color-warning);
}

.status-pill.starting .dot {
  animation: pulse 1.5s ease-in-out infinite;
}

.status-pill.error {
  color: var(--color-error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.icon-btn {
  width: 28px;
  height: 28px;
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

/* 内容区 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8) var(--space-8) var(--space-12);
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}

.section {
  margin-bottom: var(--space-10);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.section-header h2 {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.section-count {
  font-size: var(--font-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
}

.new-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.new-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-bg-elevated);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.empty-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) 0;
  gap: var(--space-3);
  border: 1px dashed var(--color-border-soft);
  border-radius: var(--radius-lg);
}

.empty-text {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
}

.link-btn {
  font-size: var(--font-sm);
  color: var(--color-accent);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.link-btn:hover {
  background: var(--color-accent-soft);
}

.edit-dot {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  opacity: 0;
  transition: all var(--transition-fast);
}

.assistant-card:hover .edit-dot {
  opacity: 0.6;
}

.edit-dot:hover {
  opacity: 1 !important;
}
</style>
