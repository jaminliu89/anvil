<script setup lang="ts">
import { ref, onMounted } from 'vue'

const AGENTS = [
  { id: 'claude', name: 'Claude Code', desc: 'Anthropic 编码 Agent（需安装）' },
  { id: 'codex', name: 'Codex', desc: 'OpenAI 编码 Agent（需安装）' },
  { id: 'hermes', name: 'Hermes', desc: 'Nous 研究 Agent' },
  { id: 'pi', name: 'PI', desc: '轻量级开源编码 Agent' },
  { id: 'openclaw', name: 'OpenClaw', desc: '开源编码 Agent' },
  { id: 'opencode', name: 'OpenCode', desc: '开源编码 Agent' },
]

const unslothAlive = ref(false)
const loading = ref(true)
const starting = ref<Record<string, boolean>>({})
const started = ref<Record<string, string>>({})

async function checkUnsloth() {
  try {
    const r = await fetch('http://127.0.0.1:18443/unsloth/status')
    const data = await r.json()
    unslothAlive.value = data.alive
  } catch {
    unslothAlive.value = false
  } finally {
    loading.value = false
  }
}

async function startAgent(id: string) {
  starting.value[id] = true
  try {
    const r = await fetch(`http://127.0.0.1:18443/unsloth/start/${id}`, { method: 'POST' })
    const data = await r.json()
    if (data.ok) {
      started.value[id] = data.message || '已启动'
    } else {
      started.value[id] = '启动失败'
    }
  } catch {
    started.value[id] = '启动失败'
  } finally {
    starting.value[id] = false
  }
}

function openUnsloth() {
  window.open('unsloth://', '_blank')
}

onMounted(() => {
  checkUnsloth()
})
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">连接</h1>
      <p class="page-sub">通过 Unsloth 桥接编码 Agent</p>
    </div>

    <div class="card status-card">
      <div class="status-row">
        <span class="label">Unsloth 工坊</span>
        <span v-if="loading" class="badge badge-pending">检测中</span>
        <span v-else-if="unslothAlive" class="badge badge-online">在线</span>
        <span v-else class="badge badge-offline">离线</span>
      </div>
      <p v-if="!unslothAlive && !loading" class="offline-hint">
        需要先启动 Unsloth Desktop 才能桥接 Agent
      </p>
      <button v-if="!unslothAlive && !loading" class="btn btn-primary" @click="openUnsloth()">
        启动 Unsloth Desktop
      </button>
    </div>

    <div v-if="unslothAlive" class="section-head">
      <h2 class="section-title">可用 Agent</h2>
    </div>

    <div v-if="unslothAlive" class="agent-list">
      <div v-for="agent in AGENTS" :key="agent.id" class="agent-item">
        <div class="agent-left">
          <div class="agent-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
              <path d="M16 14H8a4 4 0 0 0-4 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a4 4 0 0 0-4-4z"/>
            </svg>
          </div>
          <div class="agent-info">
            <span class="agent-name">{{ agent.name }}</span>
            <span class="agent-desc">{{ agent.desc }}</span>
          </div>
        </div>
        <div class="agent-right">
          <span v-if="started[agent.id]" class="started-label">{{ started[agent.id] }}</span>
          <button
            v-else
            class="btn btn-secondary"
            :class="{ loading: starting[agent.id] }"
            :disabled="starting[agent.id]"
            @click="startAgent(agent.id)"
          >
            {{ starting[agent.id] ? '启动中...' : '启动' }}
          </button>
        </div>
      </div>
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

.offline-hint {
  font-size: var(--font-xs); color: var(--color-text-tertiary);
  margin: var(--space-3) 0 0 0;
}

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
.btn-secondary:disabled { opacity: 0.5; cursor: default; }
.loading { opacity: 0.7; }

.section-head { margin-bottom: var(--space-3); }
.section-title {
  font-size: var(--font-sm); font-weight: var(--font-medium);
}

.agent-list {
  display: flex; flex-direction: column; gap: 1px;
  background: var(--color-border-soft);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md); overflow: hidden;
}
.agent-item {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
}
.agent-left { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.agent-icon {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.agent-icon svg { color: var(--color-text-tertiary); }
.agent-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.agent-name { font-size: var(--font-sm); font-weight: var(--font-medium); color: var(--color-text); }
.agent-desc { font-size: var(--font-2xs); color: var(--color-text-tertiary); }
.agent-right { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
.started-label {
  font-size: var(--font-2xs); color: var(--color-success);
}
</style>