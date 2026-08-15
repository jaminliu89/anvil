<script setup lang="ts">
// 运行页 — 大脑状态 + 体检

import { ref, onMounted } from 'vue'
import { useDshStore } from '@/stores/dsh'
import { doctor, type DoctorResult } from '@/services/dsh'

const dshStore = useDshStore()
const doc = ref<DoctorResult | null>(null)
const checking = ref(false)
const switching = ref(false)

async function runDoctor() {
  checking.value = true
  try {
    doc.value = await doctor()
  } catch (e) {
    doc.value = { ok: false, checks: [{ name: '服务', ok: false, detail: String(e) }] }
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
      <h1 class="page-title">运行</h1>
      <p class="page-sub">AI 的状态与体检</p>
    </div>

    <section class="card">
      <div class="card-head"><h2>大脑</h2>
        <span class="badge" :class="dshStore.status === 'running' ? 'ok' : 'bad'">
          {{ dshStore.status === 'running' ? '就绪' : '未就绪' }}
        </span>
      </div>
      <div class="brain-info">
        <div class="row"><span class="k">当前</span><span class="v">{{ dshStore.target.includes('8888') ? '训练工坊模型' : '主力模型' }}</span></div>
        <div class="row"><span class="k">守卫</span><span class="v">{{ dshStore.status === 'running' ? '在线' : '离线' }}</span></div>
      </div>
      <div class="brain-switch">
        <button class="btn" :class="{ active: !dshStore.target.includes('8888') }" @click="switchBrain('http://localhost:18080/v1')" :disabled="switching">主力模型</button>
        <button class="btn" :class="{ active: dshStore.target.includes('8888') }" @click="switchBrain('http://localhost:8888/v1')" :disabled="switching">训练工坊模型</button>
      </div>
    </section>

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
  </div>
</template>

<style scoped>
.view { padding: 28px 32px; max-width: 720px; }
.page-head { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; color: var(--ink); margin: 0 0 4px; }
.page-sub { font-size: 13px; color: var(--ink3); margin: 0; }

.card { background: var(--raised); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-head h2 { font-size: 14px; font-weight: 600; color: var(--ink2); margin: 0; }

.badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; }
.badge.ok { color: var(--color-success, #50634f); background: rgba(80, 99, 79, 0.1); }
.badge.bad { color: var(--color-error, #7a5049); background: rgba(122, 80, 73, 0.1); }

.brain-info { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.row { display: flex; font-size: 13px; }
.k { width: 60px; color: var(--ink4); }
.v { color: var(--ink2); }

.brain-switch { display: flex; gap: 8px; }
.btn { border: 1px solid var(--line); background: var(--raised); color: var(--ink2); border-radius: 8px; padding: 5px 12px; font-size: 12px; cursor: pointer; font-family: inherit; }
.btn:hover { border-color: var(--signal); }
.btn.active { background: var(--signal-soft, #ece7de); border-color: var(--signal); color: var(--signal); }

.check-list { display: flex; flex-direction: column; gap: 8px; }
.check { display: flex; justify-content: space-between; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
.check.pass { background: rgba(80, 99, 79, 0.08); }
.check.fail { background: rgba(122, 80, 73, 0.08); }
.check-name { font-weight: 500; color: var(--ink2); }
.check-detail { color: var(--ink4); font-size: 12px; }
.hint { font-size: 12px; color: var(--ink4); margin: 0; }
</style>
