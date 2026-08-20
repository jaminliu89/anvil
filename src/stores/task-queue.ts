// 任务队列 store — 跟踪所有异步任务的状态
// TimelineView 在任务创建/更新时自动注册

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TaskItem {
  id: string
  entryId: string
  adapterId: string
  title: string
  sessionId: string
  status: 'queued' | 'running' | 'awaiting-approval' | 'done' | 'failed' | 'error'
  createdAt: number
  branch?: string
  approved?: boolean
}

export const useTaskQueueStore = defineStore('task-queue', () => {
  const tasks = ref<TaskItem[]>([])

  const activeTasks = computed(() =>
    tasks.value.filter(t =>
      t.status === 'queued' || t.status === 'running' || t.status === 'awaiting-approval'
    )
  )

  const completedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'done' || t.status === 'failed' || t.status === 'error')
  )

  function addOrUpdate(item: TaskItem) {
    const idx = tasks.value.findIndex(t => t.entryId === item.entryId)
    if (idx >= 0) {
      tasks.value[idx] = { ...tasks.value[idx], ...item }
    } else {
      tasks.value.push(item)
    }
  }

  function remove(entryId: string) {
    tasks.value = tasks.value.filter(t => t.entryId !== entryId)
  }

  function clear() {
    tasks.value = []
  }

  return { tasks, activeTasks, completedTasks, addOrUpdate, remove, clear }
})