<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTeamStore } from '@/stores/team'
import { useDshStore } from '@/stores/dsh'
import { getDshWebUrl, startDsh } from '@/services/dsh'

const router = useRouter()
const route = useRoute()
const teamStore = useTeamStore()
const dshStore = useDshStore()

// 确保当前助手是对的
onMounted(() => {
  const id = route.params.id as string
  teamStore.setCurrentAssistant(id)
  // 如果 DSH 没启动，手动启动
  if (dshStore.status === 'idle' || dshStore.status === 'error') {
    startDsh().catch((e) => console.error('启动 DSH 失败', e))
  }
})

const assistant = computed(() => teamStore.currentAssistant)

const iframeUrl = computed(() => {
  if (dshStore.port) {
    return getDshWebUrl(dshStore.port)
  }
  return ''
})

const isLoading = computed(() => dshStore.status !== 'running')

// 手动重试
function retryStart() {
  startDsh().catch((e) => console.error('启动 DSH 失败', e))
}
</script>

<template>
  <div class="chat-view">
    <!-- 顶部栏 -->
    <header class="chat-header">
      <button class="back-btn" @click="router.push('/')">← 返回团队</button>
      <div class="header-info">
        <span class="assistant-avatar">{{ assistant?.avatar }}</span>
        <div>
          <h2>{{ assistant?.name || '助手' }}</h2>
          <span class="assistant-role">{{ assistant?.role }}</span>
        </div>
      </div>
      <div class="header-status">
        <span class="status-dot" :class="dshStore.status"></span>
        <span class="status-text">
          {{ dshStore.status === 'running' ? '运行中' :
             dshStore.status === 'starting' ? '启动中…' :
             dshStore.status === 'error' ? '启动失败' :
             dshStore.status === 'stopping' ? '停止中' : '未启动' }}
        </span>
      </div>
    </header>

    <!-- 内容区 -->
    <div class="chat-body">
      <!-- 加载态 -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p class="loading-text">
          {{ dshStore.status === 'starting' ? '正在启动 AI 助手…' :
             dshStore.status === 'error' ? '启动失败' : '准备中…' }}
        </p>
        <p v-if="dshStore.status === 'error'" class="error-msg">
          {{ dshStore.error }}
        </p>
        <button v-if="dshStore.status === 'error'" class="retry-btn" @click="retryStart">
          重试
        </button>
      </div>

      <!-- DSH Web UI 嵌入 -->
      <iframe
        v-show="!isLoading"
        :src="iframeUrl"
        class="dsh-iframe"
        frameborder="0"
        title="DSH Web UI"
      ></iframe>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
  height: var(--header-height);
}

.back-btn {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.back-btn:hover {
  background: var(--color-bg-tertiary);
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
}

.assistant-avatar {
  font-size: 20px;
}

.header-info h2 {
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
}

.assistant-role {
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
}

.header-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
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
  50% { opacity: 0.4; }
}

.chat-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.dsh-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

.loading-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-md);
  color: var(--color-text-secondary);
}

.error-msg {
  font-size: var(--font-sm);
  color: var(--color-error);
  max-width: 400px;
  text-align: center;
}

.retry-btn {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-6);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  color: var(--color-text);
  transition: all var(--transition-fast);
}

.retry-btn:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-border-strong);
}
</style>
