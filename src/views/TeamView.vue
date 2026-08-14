<script setup lang="ts">
import { useTeamStore } from '@/stores/team'
import { useRouter } from 'vue-router'
import AssistantCard from '@/components/team/AssistantCard.vue'
import { useDshStore } from '@/stores/dsh'
import { computed } from 'vue'

const teamStore = useTeamStore()
const dshStore = useDshStore()
const router = useRouter()

const statusText = computed(() => {
  switch (dshStore.status) {
    case 'starting': return '启动中…'
    case 'running': return '运行中'
    case 'error': return '启动失败'
    default: return ''
  }
})

function openAssistant(id: string) {
  teamStore.setCurrentAssistant(id)
  router.push(`/chat/${id}`)
}
</script>

<template>
  <div class="team-view">
    <!-- 顶部 -->
    <header class="team-header">
      <div class="team-title">
        <h1>我的 AI 团队</h1>
        <p class="team-subtitle">选一个助手，给它派活</p>
      </div>
      <div class="team-status" :class="dshStore.status">
        <span class="status-dot"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>
    </header>

    <!-- 助手卡片网格 -->
    <div class="assistant-grid">
      <AssistantCard
        v-for="a in teamStore.assistants"
        :key="a.id"
        :assistant="a"
        @click="openAssistant(a.id)"
      />
    </div>

    <!-- 底部 -->
    <footer class="team-footer">
      <span class="footer-text">由 DeepSeek Harness 驱动 · 数据全在你电脑上</span>
      <button class="settings-btn" @click="router.push('/settings')">
        设置
      </button>
    </footer>
  </div>
</template>

<style scoped>
.team-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--space-8) var(--space-10);
  background: var(--color-bg);
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8);
}

.team-title h1 {
  font-size: var(--font-2xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-1);
}

.team-subtitle {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.team-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.team-status.running {
  color: var(--color-success);
}

.team-status.starting {
  color: var(--color-warning);
}

.team-status.error {
  color: var(--color-error);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-dot.starting {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.assistant-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
  align-content: start;
}

.team-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border-soft);
}

.footer-text {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
}

.settings-btn {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.settings-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
}
</style>
