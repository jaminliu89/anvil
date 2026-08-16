<script setup lang="ts">
// 守卫面板（高级）— 体检 / 消息审计 / 抢救日志

import { ref, onMounted } from 'vue'
import { doctor, type DoctorResult } from '@/services/dsh'

const doc = ref<DoctorResult | null>(null)
const checking = ref(false)
const salvage = ref<{ log: { ts: number; pattern: string }[] } | null>(null)

async function runDoctor() {
  checking.value = true
  try {
    doc.value = await doctor()
  } catch (e) {
    doc.value = { ok: false, checks: [{ name: '守卫服务', ok: false, detail: String(e) }] }
  }
  checking.value = false
}

async function loadSalvage() {
  try {
    const res = await fetch('http://127.0.0.1:18443/salvage-log')
    salvage.value = await res.json()
  } catch {
    salvage.value = null
  }
}

onMounted(() => {
  runDoctor()
  loadSalvage()
})
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">守卫</h1>
      <p class="page-sub">协议加固侧车 · 规则引擎驱动 · 静默自动修复</p>
    </div>

    <section class="card">
      <div class="card-head">
        <div class="card-title" style="margin: 0">守卫引擎体检</div>
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
      <p v-else class="hint">服务未运行</p>
    </section>

    <section class="card">
      <div class="card-head">
        <div class="card-title" style="margin: 0">工具调用抢救日志 (Salvage Log)</div>
        <button class="btn btn-sm" @click="loadSalvage">刷新</button>
      </div>
      <div v-if="salvage && salvage.log.length > 0" class="salvage-list">
        <div v-for="(s, i) in salvage.log.slice().reverse()" :key="i" class="salvage">
          <span class="pattern">自动修复模式: {{ s.pattern }}</span>
          <span class="time">{{ new Date(s.ts * 1000).toLocaleTimeString() }}</span>
        </div>
      </div>
      <p v-else class="hint">暂无记录 · 所有对话与工具调用均格式正常</p>
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

.card {
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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
.check-name { font-weight: var(--font-semibold); color: var(--ink); }
.check-detail { color: var(--ink3); font-size: var(--font-xs); }

.salvage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.salvage {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: var(--font-xs);
}
.pattern { color: var(--ink); font-weight: var(--font-medium); }
.time { color: var(--ink4); }

.btn {
  padding: 6px 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: var(--radius-md);
  font-size: var(--font-xs);
  cursor: pointer;
}
.btn:hover {
  border-color: var(--signal);
}
.btn-sm { padding: 4px 10px; }

.hint {
  font-size: var(--font-xs);
  color: var(--ink3);
}
</style>