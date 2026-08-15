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
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">守卫</h1>
      <p class="page-sub">协议加固层 · 对话质量的可视化</p>
    </div>

    <section class="card">
      <div class="card-head">
        <h2>体检</h2>
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
      <div class="card-head"><h2>抢救日志</h2><button class="btn" @click="loadSalvage">刷新</button></div>
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
.view { padding: 28px 32px; max-width: 720px; }
.page-head { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; color: var(--ink); margin: 0 0 4px; }
.page-sub { font-size: 13px; color: var(--ink3); margin: 0; }

.card { background: var(--raised); border: 1px solid var(--line); border-radius: var(--radius-surface, 12px); padding: 18px 20px; margin-bottom: 16px; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-head h2 { font-size: 14px; font-weight: 600; color: var(--ink2); margin: 0; }

.btn { border: 1px solid var(--line); background: var(--raised); color: var(--ink2); border-radius: 8px; padding: 5px 12px; font-size: 12px; cursor: pointer; font-family: inherit; }
.btn:hover { border-color: var(--signal); color: var(--signal); }

.check-list { display: flex; flex-direction: column; gap: 8px; }
.check { display: flex; justify-content: space-between; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
.check.pass { background: rgba(80, 99, 79, 0.08); }
.check.fail { background: rgba(122, 80, 73, 0.08); }
.check-name { font-weight: 500; color: var(--ink2); }
.check-detail { color: var(--ink4); font-size: 12px; }

.salvage-list { display: flex; flex-direction: column; gap: 6px; }
.salvage { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink3); }
.pattern { color: var(--ink2); }
.time { color: var(--ink4); }
.hint { font-size: 12px; color: var(--ink4); margin: 0; }
</style>
