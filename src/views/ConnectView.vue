<script setup lang="ts">
import { ref, onMounted } from 'vue'

const AGENTS = [
  { id: 'claude', name: 'Claude Code', desc: 'Anthropic 编码 Agent（需安装）' },
  { id: 'codex', name: 'Codex', desc: '智能编码 Agent（需安装）' },
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
  <div class="connect-view">
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
      <h3 class="section-title">可用 Agent</h3>
    </div>

    <div v-if="unslothAlive" class="agent-list">
      <div v-for="agent in AGENTS" :key="agent.id" class="agent-item">
        <div class="agent-left">
          <div class="agent-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
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
.connect-view { padding: 12px 16px 16px; }

.card {
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label { font-size: 13px; font-weight: 500; color: var(--ink2); }

.badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  font-family: var(--mono);
}
.badge-online {
  background: rgba(70, 100, 79, 0.1);
  color: var(--success);
}
.badge-offline {
  background: var(--muted);
  color: var(--ink3);
}
.badge-pending {
  background: rgba(118, 92, 61, 0.1);
  color: var(--warning);
}

.offline-hint {
  font-size: 12px;
  color: var(--ink3);
  margin: 10px 0 0 0;
  line-height: 1.5;
}

.btn {
  height: 28px;
  padding: 0 12px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: all 120ms ease;
  border: none;
}
.btn-primary {
  margin-top: 10px;
  background: var(--signal);
  color: var(--canvas);
}
.btn-primary:hover { opacity: 0.9; }
.btn-secondary {
  background: var(--canvas);
  color: var(--ink2);
  border: 1px solid var(--line);
}
.btn-secondary:hover { border-color: var(--ink3); }
.btn-secondary:disabled { opacity: 0.5; cursor: default; }
.loading { opacity: 0.7; }

.section-head { margin-bottom: 8px; }
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

.agent-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  overflow: hidden;
  background: var(--line-subtle);
  gap: 1px;
}
.agent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--surface);
}
.agent-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.agent-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--muted);
  border-radius: 6px;
  flex-shrink: 0;
  color: var(--ink3);
}
.agent-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.agent-name { font-size: 12px; font-weight: 500; color: var(--ink); }
.agent-desc { font-size: 11px; color: var(--ink3); }
.agent-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.started-label {
  font-size: 11px;
  color: var(--success);
}
</style>