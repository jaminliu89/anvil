<script setup lang="ts">
import { useTaskQueueStore } from '@/stores/task-queue'
import { get } from '@/adapters/registry'

const queue = useTaskQueueStore()

function adapterName(id: string): string {
  const a = get(id)
  return a?.name || id
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    'queued': '排队中',
    'running': '执行中',
    'awaiting-approval': '待审批',
    'done': '已完成',
    'failed': '失败',
    'error': '错误',
  }
  return map[s] || s
}

function statusClass(s: string): string {
  const map: Record<string, string> = {
    'queued': 'secondary',
    'running': 'warn',
    'awaiting-approval': 'accent',
    'done': 'good',
    'failed': 'bad',
    'error': 'bad',
  }
  return map[s] || 'secondary'
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}
</script>

<template>
  <div class="queue-view">
    <!-- 运行中任务 -->
    <div v-if="queue.activeTasks.length > 0" class="queue-section">
      <div class="section-title">运行中</div>
      <div v-for="task in queue.activeTasks" :key="task.id" class="queue-item"
           :class="statusClass(task.status)">
        <div class="qi-header">
          <span class="qi-adapter">{{ adapterName(task.adapterId) }}</span>
          <span class="qi-status" :class="statusClass(task.status)">{{ statusLabel(task.status) }}</span>
        </div>
        <div class="qi-title">{{ task.title }}</div>
        <div class="qi-meta">
          <span v-if="task.sessionId" class="qi-sid">{{ task.sessionId.slice(0, 16) }}</span>
          <span class="qi-time">{{ timeAgo(task.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- 已完成任务 -->
    <div v-if="queue.completedTasks.length > 0" class="queue-section">
      <div class="section-title">已完成</div>
      <div v-for="task in queue.completedTasks.slice(0, 10)" :key="task.id" class="queue-item done">
        <div class="qi-header">
          <span class="qi-adapter">{{ adapterName(task.adapterId) }}</span>
          <span class="qi-status good">{{ statusLabel(task.status) }}</span>
        </div>
        <div class="qi-title">{{ task.title }}</div>
        <div class="qi-meta">
          <span class="qi-time">{{ timeAgo(task.createdAt) }}</span>
        </div>
      </div>
    </div>

    <div v-if="queue.tasks.length === 0" class="queue-empty">
      暂无任务
    </div>
  </div>
</template>

<style scoped>
.queue-view { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.queue-section { display: flex; flex-direction: column; gap: 8px; }
.section-title {
  font-size: 10px; color: var(--ink4); text-transform: uppercase;
  letter-spacing: 0.08em; font-weight: 500;
}
.queue-item {
  background: var(--surface); border: 1px solid var(--line-subtle);
  border-radius: 8px; padding: 10px 12px; display: flex;
  flex-direction: column; gap: 4px;
}
.queue-item.bad { border-color: rgba(120,75,70,0.2); background: rgba(120,75,70,0.04); }
.queue-item.good { border-color: rgba(70,100,79,0.2); }
.qi-header { display: flex; justify-content: space-between; align-items: center; }
.qi-adapter { font-size: 10px; font-weight: 600; color: var(--ink3); text-transform: uppercase; letter-spacing: 0.04em; }
.qi-status {
  font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 500;
}
.qi-status.warn { background: rgba(180,140,60,0.1); color: rgb(180,140,60); }
.qi-status.accent { background: var(--signalSoft); color: var(--signal); }
.qi-status.good { background: rgba(70,100,79,0.1); color: var(--success); }
.qi-status.bad { background: rgba(120,75,70,0.1); color: var(--error); }
.qi-title { font-size: 13px; color: var(--ink); font-weight: 500; line-height: 1.3; }
.qi-meta { display: flex; gap: 8px; font-size: 10px; color: var(--ink4); font-family: var(--mono); }
.queue-empty { color: var(--ink4); font-size: 13px; text-align: center; padding: 32px 0; }
</style>