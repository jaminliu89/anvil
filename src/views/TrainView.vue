<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Checkpoint {
  name?: string
  path?: string
  model?: string
  created_at?: string
  [key: string]: unknown
}

const alive = ref(false)
const detail = ref<any>(null)
const loading = ref(true)
const checkpoints = ref<Checkpoint[]>([])
const cpLoading = ref(false)

async function fetchStatus() {
  try {
    const r = await fetch('http://127.0.0.1:18443/unsloth/status')
    const data = await r.json()
    alive.value = data.alive
    detail.value = data.detail
  } catch {
    alive.value = false
  } finally {
    loading.value = false
  }
}

async function fetchCheckpoints() {
  cpLoading.value = true
  try {
    const r = await fetch('http://127.0.0.1:18443/unsloth/checkpoints')
    const data = await r.json()
    checkpoints.value = data.checkpoints ?? []
  } catch {
    checkpoints.value = []
  } finally {
    cpLoading.value = false
  }
}

function openDesktop() {
  window.open('unsloth://', '_blank')
}

onMounted(() => {
  fetchStatus()
  if (alive.value) fetchCheckpoints()
})
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">训练</h1>
      <p class="page-sub">让 AI 更懂你的领域 — 基于 Unsloth</p>
    </div>

    <div class="card status-card">
      <div class="status-row">
        <span class="label">Unsloth 工坊</span>
        <span v-if="loading" class="badge badge-pending">检测中</span>
        <span v-else-if="alive" class="badge badge-online">在线</span>
        <span v-else class="badge badge-offline">离线</span>
      </div>
      <div v-if="!loading && alive && detail" class="detail">
        <div class="detail-item">
          <span class="detail-label">版本</span>
          <span class="detail-value">{{ detail.version ?? detail.desktop_version ?? '—' }}</span>
        </div>
      </div>
      <button v-if="!alive && !loading" class="btn btn-primary" @click="openDesktop">
        启动 Unsloth Desktop
      </button>
    </div>

    <div v-if="alive" class="card actions-card">
      <div class="actions-row">
        <button class="btn btn-secondary" @click="fetchStatus; fetchCheckpoints()">
          刷新状态
        </button>
        <button class="btn btn-ghost" @click="openDesktop">
          打开详细面板
        </button>
      </div>
    </div>

    <div v-if="alive" class="section-head">
      <h2 class="section-title">训练检查点</h2>
      <button v-if="!cpLoading" class="btn btn-ghost btn-sm" @click="fetchCheckpoints()">
        刷新
      </button>
    </div>

    <div v-if="cpLoading" class="loading-hint">加载检查点...</div>

    <div v-if="!cpLoading && checkpoints.length === 0 && alive" class="card empty-card">
      <p class="empty-text">暂无检查点。打开 Unsloth Desktop 开始训练。</p>
    </div>

    <div v-if="checkpoints.length > 0" class="cp-list">
      <div v-for="(cp, i) in checkpoints" :key="i" class="cp-item">
        <div class="cp-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div class="cp-info">
            <span class="cp-name">{{ cp.name ?? cp.model ?? 'checkpoint-' + (i + 1) }}</span>
            <span class="cp-meta">{{ cp.path ?? '' }}</span>
          </div>
        </div>
        <span v-if="cp.created_at" class="cp-date">{{ cp.created_at }}</span>
      </div>
    </div>

    <div class="card help-card">
      <p class="help-text">
        训练需要 Unsloth Desktop。<br/>
        在 Unsloth 中上传数据、配置参数、启动训练，检查点会自动同步。
      </p>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: var(--space-8);
  max-width: 600px;
}
.page-head { margin-bottom: var(--space-6); }
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

/* Cards */
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}
.status-card .status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label { font-size: var(--font-sm); font-weight: var(--font-medium); }

/* Badges */
.badge {
  font-size: var(--font-2xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
}
.badge-online {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}
.badge-offline {
  background: color-mix(in srgb, var(--color-text-tertiary) 15%, transparent);
  color: var(--color-text-tertiary);
}
.badge-pending {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
}

.detail { margin-top: var(--space-3); }
.detail-item {
  display: flex; gap: var(--space-2);
  font-size: var(--font-xs);
}
.detail-label { color: var(--color-text-tertiary); min-width: 40px; }
.detail-value { color: var(--color-text-secondary); }

/* Buttons */
.btn {
  height: 32px; padding: 0 var(--space-4);
  font-size: var(--font-xs); font-weight: var(--font-medium);
  border-radius: var(--radius-sm); cursor: pointer;
  font-family: inherit;
  transition: all var(--transition-fast);
}
.btn-primary {
  margin-top: var(--space-3);
  background: var(--color-signal); color: var(--color-bg);
  border: none;
}
.btn-primary:hover { opacity: 0.85; }
.btn-secondary {
  background: var(--color-bg-tertiary); color: var(--color-text);
  border: 1px solid var(--color-border-soft);
}
.btn-secondary:hover { border-color: var(--color-border); }
.btn-ghost {
  background: none; color: var(--color-signal);
  border: none; padding: 0;
  font-size: var(--font-xs);
  cursor: pointer;
}
.btn-ghost:hover { text-decoration: underline; }
.btn-sm { height: 26px; padding: 0 var(--space-2); }

.actions-card .actions-row {
  display: flex; gap: var(--space-3);
  align-items: center;
}

/* Section */
.section-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--space-3);
}
.section-title {
  font-size: var(--font-sm); font-weight: var(--font-medium);
}

/* Checkpoints */
.loading-hint {
  font-size: var(--font-xs); color: var(--color-text-tertiary);
  margin-bottom: var(--space-3);
}
.empty-card .empty-text {
  font-size: var(--font-xs); color: var(--color-text-tertiary);
  text-align: center; margin: var(--space-2) 0;
}

.cp-list {
  display: flex; flex-direction: column; gap: 1px;
  background: var(--color-border-soft);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md); overflow: hidden;
  margin-bottom: var(--space-4);
}
.cp-item {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
}
.cp-left { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.cp-left svg { color: var(--color-text-tertiary); flex-shrink: 0; }
.cp-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.cp-name { font-size: var(--font-sm); font-weight: var(--font-medium); color: var(--color-text); }
.cp-meta { font-size: var(--font-2xs); color: var(--color-text-tertiary); }
.cp-date { font-size: var(--font-2xs); color: var(--color-text-tertiary); flex-shrink: 0; }

/* Help */
.help-card { border-style: dashed; }
.help-text {
  font-size: var(--font-xs); color: var(--color-text-tertiary);
  line-height: 1.6; margin: 0;
}
</style>