<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDshStore } from '@/stores/dsh'

const router = useRouter()
const dshStore = useDshStore()

const isRunning = computed(() => dshStore.status === 'running')

// 模拟数据 — 后续从后端拉
const uptime = '2 小时 15 分钟'
const memoryUsed = '3.2 GB'
const responseSpeed = '45/秒'
const connectedTools = 2

function goToRun() {
  router.push('/run')
}

function goToConnect() {
  router.push('/connect')
}
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">仪表盘</h1>
    </div>

    <div class="cards">
      <!-- AI 运行状态 -->
      <div class="card status-card" :class="{ running: isRunning }">
        <div class="card-header">
          <svg class="card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span class="card-title">运行状态</span>
        </div>
        <div class="status-row">
          <span class="status-dot" :class="{ active: isRunning }"></span>
          <span class="status-text">{{ isRunning ? '运行中' : '已停止' }}</span>
        </div>
        <div v-if="isRunning" class="stat-row">
          <span class="stat-label">已运行</span>
          <span class="stat-value">{{ uptime }}</span>
        </div>
        <button class="card-action" @click="goToRun">
          {{ isRunning ? '管理运行' : '启动' }}
        </button>
      </div>

      <!-- 响应速度 -->
      <div class="card">
        <div class="card-header">
          <svg class="card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span class="card-title">响应速度</span>
        </div>
        <div class="big-number">{{ responseSpeed }}</div>
        <div class="stat-desc">每秒处理量</div>
      </div>

      <!-- 内存 -->
      <div class="card">
        <div class="card-header">
          <svg class="card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18"></rect>
            <line x1="6" y1="6" x2="6" y2="18"></line>
            <line x1="10" y1="6" x2="10" y2="18"></line>
            <line x1="14" y1="6" x2="14" y2="18"></line>
            <line x1="18" y1="6" x2="18" y2="12"></line>
          </svg>
          <span class="card-title">内存</span>
        </div>
        <div class="big-number">{{ memoryUsed }}</div>
        <div class="stat-desc">已使用</div>
      </div>

      <!-- 已连接工具 -->
      <div class="card">
        <div class="card-header">
          <svg class="card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          <span class="card-title">已连接工具</span>
        </div>
        <div class="big-number">{{ connectedTools }}</div>
        <div class="stat-desc">个工具在线</div>
        <button class="card-action" @click="goToConnect">管理连接</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: var(--space-8) var(--space-8);
  max-width: 720px;
}

.page-head {
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--font-lg);
  font-weight: var(--font-semibold);
  letter-spacing: -0.01em;
}

/* 卡片网格 */
.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-tertiary);
}

.card-icon {
  flex-shrink: 0;
}

.card-title {
  font-size: var(--font-2xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* 状态 card */
.status-card {
  grid-column: 1 / -1;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  transition: background var(--transition-base);
}

.status-dot.active {
  background: var(--color-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 25%, transparent);
}

.status-text {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--color-text);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-xs);
}

.stat-label {
  color: var(--color-text-tertiary);
}

.stat-value {
  color: var(--color-text-secondary);
}

.big-number {
  font-size: var(--font-2xl);
  font-weight: var(--font-semibold);
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--color-text);
}

.stat-desc {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
  margin-top: -1px;
}

.card-action {
  margin-top: auto;
  padding: var(--space-1) 0;
  font-size: var(--font-xs);
  color: var(--color-signal);
  font-family: inherit;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  border-top: 1px solid var(--color-border-soft);
  padding-top: var(--space-2);
  transition: color var(--transition-fast);
}

.card-action:hover {
  color: var(--color-text);
}
</style>