<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listConvs, deleteConv, newConvId } from '@/utils/conv-store'

interface ConvItem {
  id: string
  title: string
  updatedAt: number
}

const emit = defineEmits<{
  select: [id: string]
  new: []
}>()

const convs = ref<ConvItem[]>([])
const currentId = ref(localStorage.getItem('anvil.conv.current') || '')

function refresh() {
  convs.value = listConvs()
}

function selectConv(id: string) {
  currentId.value = id
  localStorage.setItem('anvil.conv.current', id)
  emit('select', id)
}

function newConv() {
  const id = newConvId()
  currentId.value = id
  localStorage.setItem('anvil.conv.current', id)
  emit('new')
}

function removeConv(id: string, e: Event) {
  e.stopPropagation()
  if (!confirm('确定删除这个对话？')) return
  deleteConv(id)
  refresh()
  if (currentId.value === id) {
    newConv()
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return days[d.getDay()]
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

onMounted(refresh)

// 暴露给父组件刷新
defineExpose({ refresh, newConv })
</script>

<template>
  <div class="history-panel">
    <div class="history-header">
      <button class="new-btn" @click="newConv">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        新对话
      </button>
    </div>

    <div v-if="convs.length === 0" class="history-empty">
      暂无对话
    </div>

    <div v-else class="history-list">
      <div
        v-for="c in convs"
        :key="c.id"
        class="history-item"
        :class="{ active: c.id === currentId }"
        @click="selectConv(c.id)"
      >
        <span class="item-title">{{ c.title }}</span>
        <span class="item-time">{{ formatTime(c.updatedAt) }}</span>
        <button class="item-delete" @click="removeConv(c.id, $event)" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.history-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-subtle);
}

.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--canvas);
  color: var(--ink2);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 120ms ease;
}
.new-btn:hover {
  border-color: var(--ink3);
  background: var(--surface);
}

.history-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink4);
  font-size: 13px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 120ms ease;
  position: relative;
}
.history-item:hover {
  background: var(--muted);
}
.history-item.active {
  background: var(--signalSoft);
}
.history-item.active .item-title {
  color: var(--ink);
  font-weight: 500;
}

.item-title {
  flex: 1;
  font-size: 13px;
  color: var(--ink2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-time {
  font-size: 11px;
  color: var(--ink4);
  flex-shrink: 0;
}

.item-delete {
  width: 24px;
  height: 24px;
  display: none;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--ink3);
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  flex-shrink: 0;
}
.history-item:hover .item-delete {
  display: flex;
}
.item-delete:hover {
  color: var(--error);
  background: rgba(120, 75, 70, 0.1);
}
</style>
