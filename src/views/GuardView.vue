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
    doc.value = { ok: false, checks: [{ name: '服务', ok: false, detail: String(e) }] }
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
  <div class="guard-view">
    <section class="card">
      <div class="card-head">
        <h3>体检</h3>
        <button class="btn" @click="runDoctor" :disabled="checking">{{ checking ? '检查中…' : '重新体检' }}</button>
      </div>
      <div v-if="doc" class="check-list">
        <div v-for="c in doc.checks" :key="c.name" class="check" :class="c.ok ? 'pass' : 'fail'">
          <span class="check-name">{{ c.name }}</span>
          <span class="check-detail">{{ c.detail }}</span>
        </div>
      </div>
      <p v-else class="hint">未运行</p>
    </section>

    <section class="card">
      <div class="card-head"><h3>抢救日志</h3><button class="btn" @click="loadSalvage">刷新</button></div>
      <div v-if="salvage && salvage.log.length > 0" class="salvage-list">
        <div v-for="(s, i) in salvage.log.slice().reverse()" :key="i" class="salvage">
          <span class="pattern">{{ s.pattern }}</span>
          <span class="time">{{ new Date(s.ts * 1000).toLocaleTimeString() }}</span>
        </div>
      </div>
      <p v-else class="hint">暂无记录 · 工具调用一切正常</p>
    </section>
  </div>
</template>

<style scoped>
.guard-view { padding: 12px 16px 16px; }

.card {
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.card-head h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.btn {
  border: 1px solid var(--line);
  background: var(--canvas);
  color: var(--ink2);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition: all 120ms ease;
}
.btn:hover {
  border-color: var(--ink3);
  color: var(--ink);
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.check-list { display: flex; flex-direction: column; gap: 6px; }
.check { display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 6px; font-size: 12px; }
.check.pass { background: rgba(70, 100, 79, 0.08); }
.check.fail { background: rgba(120, 75, 70, 0.08); }
.check-name { font-weight: 500; color: var(--ink2); }
.check-detail { color: var(--ink3); font-size: 11px; }

.salvage-list { display: flex; flex-direction: column; gap: 4px; }
.salvage { display: flex; justify-content: space-between; font-size: 11px; color: var(--ink3); }
.pattern { color: var(--ink2); }
.time { color: var(--ink4); }
.hint { font-size: 12px; color: var(--ink4); margin: 0; }
</style>
