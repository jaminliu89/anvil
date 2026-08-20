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
  <div class="runtime-view">
    <section class="card">
      <div class="card-head"><h3>大脑</h3>
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
  </div>
</template>

<style scoped>
.runtime-view { padding: 12px 16px 16px; }

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

.badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; font-family: var(--mono); }
.badge.ok { color: var(--success); background: rgba(70, 100, 79, 0.08); }
.badge.bad { color: var(--error); background: rgba(120, 75, 70, 0.08); }

.brain-info { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.row { display: flex; font-size: 12px; }
.k { width: 50px; color: var(--ink4); flex-shrink: 0; }
.v { color: var(--ink2); }

.brain-switch { display: flex; gap: 6px; }
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
.btn:hover { border-color: var(--ink3); }
.btn.active { background: var(--signalSoft); border-color: var(--signal); color: var(--signal); }
.btn:disabled { opacity: 0.5; cursor: default; }

.check-list { display: flex; flex-direction: column; gap: 6px; }
.check { display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 6px; font-size: 12px; }
.check.pass { background: rgba(70, 100, 79, 0.08); }
.check.fail { background: rgba(120, 75, 70, 0.08); }
.check-name { font-weight: 500; color: var(--ink2); }
.check-detail { color: var(--ink3); font-size: 11px; }
.hint { font-size: 12px; color: var(--ink4); margin: 0; }
</style>
