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

  // 如果 DSH 是 idle 状态，后台启动
  if (dshStore.status === 'idle') {
    startDsh().catch(() => {
      // 静默失败，用户点助手时再重试
    })
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
  if (!assistant.isCustom) return // 内置助手不能编辑
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
</script>

<template>
  <div class="team-view">
    <!-- 顶部栏 -->
    <header class="team-header">
      <div class="header-left">
        <h1>我的团队</h1>
        <span class="dsh-status" :class="dshStore.status">
          <span class="status-dot"></span>
          <span class="status-text">
            {{ dshStore.status === 'running' ? '引擎就绪' :
               dshStore.status === 'starting' ? '启动中…' :
               dshStore.status === 'error' ? '引擎异常' : '待机' }}
          </span>
        </span>
      </div>
      <div class="header-right">
        <button class="new-btn" @click="openNewAssistant">
          <span class="plus">+</span> 新建助手
        </button>
        <button class="settings-btn" @click="router.push('/settings')" title="设置">
          ⚙
        </button>
      </div>
    </header>

    <!-- 助手网格 -->
    <div class="team-body">
      <div class="section-label">预设助手</div>
      <div class="assistant-grid">
        <AssistantCard
          v-for="a in teamStore.presetAssistants"
          :key="a.id"
          :assistant="a"
          @click="openChat(a)"
        />
      </div>

      <div v-if="teamStore.customAssistants.length > 0" class="section-label" style="margin-top: 32px">
        我的助手
      </div>
      <div v-if="teamStore.customAssistants.length > 0" class="assistant-grid">
        <AssistantCard
          v-for="a in teamStore.customAssistants"
          :key="a.id"
          :assistant="a"
          @click="openChat(a)"
          @contextmenu.prevent="openEditAssistant(a, $event)"
        >
          <button class="edit-badge" @click="openEditAssistant(a, $event)" title="编辑">
            ✎
          </button>
        </AssistantCard>
      </div>

      <!-- 空状态 -->
      <div v-if="teamStore.customAssistants.length === 0" class="empty-custom">
        <p>还没有自定义助手，点右上角「新建助手」创建一个吧</p>
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

.team-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--color-border-soft);
  height: var(--header-height);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.team-header h1 {
  font-size: var(--font-xl);
  font-weight: var(--font-semibold);
}

.dsh-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-pill);
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
}

.dsh-status.running {
  color: var(--color-success);
}

.dsh-status.starting {
  color: var(--color-warning);
}

.dsh-status.error {
  color: var(--color-error);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.dsh-status.starting .status-dot {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.new-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  background: var(--color-accent);
  color: #1a1a1a;
  font-weight: var(--font-semibold);
  font-size: var(--font-sm);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.new-btn:hover {
  background: var(--color-accent-hover);
}

.plus {
  font-size: var(--font-lg);
  font-weight: 400;
  line-height: 1;
}

.settings-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.settings-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
}

.team-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.section-label {
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-3);
}

.assistant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
}

.empty-custom {
  margin-top: var(--space-8);
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-sm);
}

.edit-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  opacity: 0;
  transition: all var(--transition-fast);
}

.assistant-card:hover .edit-badge {
  opacity: 1;
}

.edit-badge:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}
</style>
