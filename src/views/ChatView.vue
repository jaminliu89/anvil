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

onMounted(() => {
  const id = route.params.id as string
  teamStore.setCurrentAssistant(id)
  if (dshStore.status === 'idle' || dshStore.status === 'error') {
    startDsh().catch(() => {})
  }
})

const assistant = computed(() => teamStore.currentAssistant)

const initial = computed(() => assistant.value?.name.charAt(0) || '?')

const iframeUrl = computed(() => {
  if (dshStore.port) {
    return getDshWebUrl(dshStore.port)
  }
  return ''
})

const isLoading = computed(() => dshStore.status !== 'running')

function retryStart() {
  startDsh().catch(() => {})
}

function backToTeam() {
  router.push('/')
}
</script>

<template>
  <div class="chat-view">
    <!-- 顶栏（含拖拽区） -->
    <header class="chat-header" data-tauri-drag-region>
      <button class="back-btn" @click="backToTeam">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      <div class="assistant-info">
        <div class="avatar" :style="{ backgroundColor: (assistant?.color || '#666') + '20', color: assistant?.color }">
          {{ initial }}
        </div>
        <div class="info-text">
          <h2>{{ assistant?.name || '助手' }}</h2>
          <span class="role">{{ assistant?.role }}</span>
        </div>
      </div>

      <div class="header-spacer"></div>

      <div class="status-indicator" :class="dshStore.status">
        <span class="dot"></span>
        <span class="label">
          {{ dshStore.status === 'running' ? '运行中' :
             dshStore.status === 'starting' ? '启动中' :
             dshStore.status === 'error' ? '异常' :
             dshStore.status === 'stopping' ? '停止中' : '待机' }}
        </span>
      </div>
    </header>

    <!-- 内容 -->
    <div class="chat-body">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-content">
          <div class="spinner-ring"></div>
          <p class="loading-text">
            {{ dshStore.status === 'starting' ? '正在启动助手…' :
               dshStore.status === 'error' ? '启动失败' : '准备中' }}
          </p>
          <p v-if="dshStore.status === 'error'" class="error-text">
            {{ dshStore.error }}
          </p>
          <button v-if="dshStore.status === 'error'" class="retry-btn" @click="retryStart">
            重试
          </button>
        </div>
      </div>

      <iframe
        v-show="!isLoading"
        :src="iframeUrl"
        class="dsh-iframe"
        frameborder="0"
        title="对话"
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
  height: var(--titlebar-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--color-border-soft);
  background: var(--color-bg);
  -webkit-app-region: drag;
  padding-left: 72px; /* 避开交通灯 */
}

.back-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  -webkit-app-region: no-drag;
}

.back-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-tertiary);
}

.assistant-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
}

.info-text h2 {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  line-height: 1.2;
}

.role {
  display: none;
}

.header-spacer {
  flex: 1;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  -webkit-app-region: no-drag;
}

.status-indicator .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.status-indicator.running {
  color: var(--color-success);
}

.status-indicator.starting {
  color: var(--color-warning);
}

.status-indicator.starting .dot {
  animation: pulse 1.5s ease-in-out infinite;
}

.status-indicator.error {
  color: var(--color-error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
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
  background: #fff;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.spinner-ring {
  width: 28px;
  height: 28px;
  border: 1.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.error-text {
  font-size: var(--font-xs);
  color: var(--color-error);
  max-width: 320px;
  text-align: center;
  line-height: 1.5;
}

.retry-btn {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-5);
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
