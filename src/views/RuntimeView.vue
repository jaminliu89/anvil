<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDshStore } from '@/stores/dsh'
import { startDsh, stopDsh } from '@/services/dsh'

const dshStore = useDshStore()

const isRunning = computed(() => dshStore.status === 'running')
const isBusy = computed(() => dshStore.status === 'starting' || dshStore.status === 'stopping')

const thinkingLevel = ref(70)      // 思考能力
const memoryLimit = ref(80)        // 记忆上限
const speedLevel = ref(90)         // 处理速度

async function handleStart() {
  if (!isBusy.value && !isRunning.value) {
    try {
      await startDsh()
    } catch (e) {
      console.error('启动失败', e)
    }
  }
}

async function handleStop() {
  if (!isBusy.value && isRunning.value) {
    try {
      await stopDsh()
    } catch (e) {
      console.error('停止失败', e)
    }
  }
}
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">运行</h1>
      <p class="page-sub">控制 AI 运行状态</p>
    </div>

    <!-- 开关区 -->
    <div class="section run-section">
      <div class="run-card">
        <div class="run-status">
          <span class="run-dot" :class="{ active: isRunning, busy: isBusy }"></span>
          <div class="run-info">
            <span class="run-label">{{ isRunning ? '运行中' : isBusy ? '处理中…' : '已停止' }}</span>
            <span v-if="isRunning" class="run-meta">启动后运行 2 小时 15 分钟</span>
            <span v-else-if="!isBusy" class="run-meta">当前未运行，点击下方按钮启动</span>
          </div>
        </div>
        <div class="run-actions">
          <button
            v-if="!isRunning"
            class="btn btn-primary"
            :disabled="isBusy"
            @click="handleStart"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="btn-icon">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            启动
          </button>
          <button
            v-if="isRunning"
            class="btn btn-secondary"
            :disabled="isBusy"
            @click="handleStop"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
              <rect x="6" y="6" width="12" height="12" rx="2"></rect>
            </svg>
            停止
          </button>
        </div>
      </div>
    </div>

    <!-- 调节区 -->
    <div class="section">
      <div class="section-label">调节</div>
      <div class="sliders">
        <div class="slider-group">
          <div class="slider-head">
            <span class="slider-name">思考能力</span>
            <span class="slider-value">{{ thinkingLevel }}%</span>
          </div>
          <div class="slider-track">
            <div class="slider-fill" :style="{ width: thinkingLevel + '%' }"></div>
            <input type="range" min="10" max="100" v-model.number="thinkingLevel" class="slider-input" />
          </div>
          <div class="slider-labels">
            <span>保守</span>
            <span>深入</span>
          </div>
        </div>

        <div class="slider-group">
          <div class="slider-head">
            <span class="slider-name">记忆上限</span>
            <span class="slider-value">{{ memoryLimit }}%</span>
          </div>
          <div class="slider-track">
            <div class="slider-fill" :style="{ width: memoryLimit + '%' }"></div>
            <input type="range" min="10" max="100" v-model.number="memoryLimit" class="slider-input" />
          </div>
          <div class="slider-labels">
            <span>简短</span>
            <span>完整</span>
          </div>
        </div>

        <div class="slider-group">
          <div class="slider-head">
            <span class="slider-name">处理速度</span>
            <span class="slider-value">{{ speedLevel }}%</span>
          </div>
          <div class="slider-track">
            <div class="slider-fill" :style="{ width: speedLevel + '%' }"></div>
            <input type="range" min="10" max="100" v-model.number="speedLevel" class="slider-input" />
          </div>
          <div class="slider-labels">
            <span>省电</span>
            <span>全速</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计 -->
    <div class="section" v-if="isRunning">
      <div class="section-label">当前状态</div>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-num">~45/秒</span>
          <span class="stat-name">响应速度</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">3.2 GB</span>
          <span class="stat-name">内存占用</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">2</span>
          <span class="stat-name">已连接工具</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: var(--space-8) var(--space-8);
  max-width: 600px;
}

.page-head {
  margin-bottom: var(--space-8);
}

.page-title {
  font-size: var(--font-lg);
  font-weight: var(--font-semibold);
  letter-spacing: -0.01em;
}

.page-sub {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

/* 分区 */
.section {
  margin-bottom: var(--space-6);
}

.section-label {
  font-size: var(--font-2xs);
  font-weight: var(--font-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: var(--space-3);
}

/* 运行卡片 */
.run-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.run-status {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.run-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: all var(--transition-base);
}

.run-dot.active {
  background: var(--color-success);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-success) 25%, transparent);
}

.run-dot.busy {
  background: var(--color-warning);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.run-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.run-label {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--color-text);
}

.run-meta {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}

.run-actions {
  display: flex;
  gap: var(--space-2);
}

/* 按钮 */
.btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  height: 32px;
  padding: 0 var(--space-4);
  font-size: var(--font-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-signal);
  color: var(--color-bg);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
  border: 1px solid var(--color-border-soft);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--color-border);
  background: var(--color-bg-elevated);
}

.btn-icon {
  flex-shrink: 0;
}

/* 滑块 */
.sliders {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.slider-group {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.slider-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.slider-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
}

.slider-value {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.slider-track {
  position: relative;
  height: 6px;
  background: var(--color-bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--color-signal);
  border-radius: 3px;
  pointer-events: none;
}

.slider-input {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-1);
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}

/* 统计网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.stat-item {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stat-num {
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.stat-name {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}
</style>