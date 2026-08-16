<script setup lang="ts">
// AI 引擎页 — Parchment 调节面板 + 体检

import { ref, onMounted } from 'vue'
import { useDshStore } from '@/stores/dsh'
import { doctor, type DoctorResult } from '@/services/dsh'

const dshStore = useDshStore()
const doc = ref<DoctorResult | null>(null)
const checking = ref(false)
const switching = ref(false)

// 智能调节滑块值
const thinkingPower = ref(85)
const memoryLimit = ref(8)

async function runDoctor() {
  checking.value = true
  try {
    doc.value = await doctor()
  } catch (e) {
    doc.value = { ok: false, checks: [{ name: '大脑服务', ok: false, detail: String(e) }] }
  }
  checking.value = false
}

async function switchBrain(target: string) {
  switching.value = true
  await dshStore.setTarget(target)
  switching.value = false
  await runDoctor()
}

onMounted(async () => {
  await dshStore.refresh()
  runDoctor()
})
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">AI 引擎</h1>
      <p class="page-sub">控制本地 AI 大脑 — 调节性能、热切换端点与健康体检</p>
    </div>

    <!-- 引擎状态条 -->
    <div class="status-bar card">
      <div class="status-bar-left">
        <span class="status-dot" :class="dshStore.status === 'running' ? 'on' : 'off'"></span>
        <div>
          <div class="status-title">{{ dshStore.status === 'running' ? '引擎运行中' : '引擎已离线' }}</div>
          <div class="status-desc">
            {{ dshStore.target.includes('8888') ? '正在使用训练工坊模型 (:8888)' : '正在使用主力模型 (:18080)' }}
          </div>
        </div>
      </div>
      <div class="status-bar-right">
        <button
          class="btn"
          :class="{ active: !dshStore.target.includes('8888') }"
          @click="switchBrain('http://localhost:18080/v1')"
          :disabled="switching"
        >
          主力模型
        </button>
        <button
          class="btn"
          :class="{ active: dshStore.target.includes('8888') }"
          @click="switchBrain('http://localhost:8888/v1')"
          :disabled="switching"
        >
          训练工坊模型
        </button>
      </div>
    </div>

    <!-- 智能调节 -->
    <section class="card">
      <div class="card-title">智能调节</div>
      <div class="slider-group">
        <div class="slider-row">
          <span class="slider-label">思考能力</span>
          <input type="range" min="10" max="100" v-model.number="thinkingPower" class="slider-input" />
          <span class="slider-value">{{ thinkingPower > 80 ? '深度推理' : '快速响应' }}</span>
        </div>
        <div class="slider-row">
          <span class="slider-label">内存上限</span>
          <input type="range" min="2" max="32" step="2" v-model.number="memoryLimit" class="slider-input" />
          <span class="slider-value">{{ memoryLimit }} GB</span>
        </div>
      </div>
      <hr class="divider" />
      <p class="slider-hint">
        思考能力越高，推理层分离与推演越深度；内存上限控制本地缓存预留。修改后即刻对下一次对话生效。
      </p>
    </section>

    <!-- 规则引擎体检 -->
    <section class="card">
      <div class="card-head">
        <div class="card-title" style="margin: 0">环境与引擎体检</div>
        <button class="btn btn-sm" @click="runDoctor" :disabled="checking">
          {{ checking ? '检查中…' : '重新体检' }}
        </button>
      </div>
      <div v-if="doc" class="check-list">
        <div v-for="c in doc.checks" :key="c.name" class="check" :class="c.ok ? 'pass' : 'fail'">
          <span class="check-name">{{ c.name }}</span>
          <span class="check-detail">{{ c.detail }}</span>
        </div>
      </div>
      <p v-else class="hint">尚未进行体检</p>
    </section>
  </div>
</template>

<style scoped>
.view {
  padding: 32px 40px;
  max-width: 720px;
}
.page-head { margin-bottom: 24px; }
.page-title { font-size: var(--font-xl); font-weight: var(--font-bold); color: var(--ink); margin-bottom: 4px; }
.page-sub { font-size: var(--font-sm); color: var(--ink3); }

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--line);
}
.status-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.status-title {
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
  color: var(--ink);
}
.status-desc {
  font-size: var(--font-xs);
  color: var(--ink3);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.on { background: var(--success); }
.status-dot.off { background: var(--ink4); }

.status-bar-right {
  display: flex;
  gap: 8px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.slider-label {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--ink2);
  min-width: 80px;
}
.slider-input {
  flex: 1;
  accent-color: var(--signal);
  cursor: pointer;
}
.slider-value {
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  color: var(--ink);
  min-width: 70px;
  text-align: right;
}

.divider {
  border: none;
  border-top: 1px solid var(--line);
  margin: 16px 0 12px;
}
.slider-hint {
  font-size: var(--font-xs);
  color: var(--ink3);
  line-height: 1.5;
}

.check-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.check {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  border: 1px solid var(--line);
}
.check.pass {
  background: rgba(80, 99, 79, 0.08);
  border-color: rgba(80, 99, 79, 0.2);
}
.check.fail {
  background: rgba(122, 80, 73, 0.08);
  border-color: rgba(122, 80, 73, 0.2);
}
.check-name {
  font-weight: var(--font-medium);
  color: var(--ink);
}
.check-detail {
  color: var(--ink3);
  font-size: var(--font-xs);
}

.btn {
  padding: 6px 14px;
  border: 1px solid var(--line);
  background: var(--raised);
  color: var(--ink2);
  border-radius: var(--radius-md);
  font-size: var(--font-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn:hover {
  border-color: var(--signal);
  color: var(--ink);
}
.btn.active {
  background: var(--signal);
  color: var(--raised);
  border-color: var(--signal);
}
.btn-sm {
  padding: 4px 10px;
}
</style>
