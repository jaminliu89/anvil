<script setup lang="ts">
// 连接页 — Parchment 设计系统 + Agent 桥接

import { ref, onMounted } from 'vue'

const AGENTS = [
  { id: 'claude', name: 'Claude Code', desc: 'Anthropic 编码 Agent（需安装）' },
  { id: 'codex', name: 'Codex', desc: '智能编码 Agent（需安装）' },
  { id: 'hermes', name: 'Hermes', desc: 'Nous 研究与任务 Agent' },
  { id: 'pi', name: 'PI', desc: '轻量级开源编码 Agent' },
  { id: 'openclaw', name: 'OpenClaw', desc: '开源自动化 Agent' },
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
      started.value[id] = data.message || '已成功桥接'
    } else {
      started.value[id] = '桥接未响应'
    }
  } catch {
    started.value[id] = '桥接服务未响应'
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
      <h1 class="page-title">Agent 连接</h1>
      <p class="page-sub">将 Anvil 本地 AI 大脑无缝接入你的开发工具与 Agent 框架</p>
    </div>

    <!-- 桥接网关状态卡 -->
    <div class="card status-card">
      <div class="status-row">
        <div>
          <div class="card-title" style="margin: 0">Unsloth 工坊桥接</div>
          <div class="sub-text">通过本地 API 桥接底层 Agent</div>
        </div>
        <span v-if="loading" class="badge badge-pending">检测中…</span>
        <span v-else-if="unslothAlive" class="badge badge-online">工坊在线</span>
        <span v-else class="badge badge-offline">工坊离线</span>
      </div>
      <p v-if="!unslothAlive && !loading" class="offline-hint">
        需先启动 Unsloth 训练工坊，Agent 即可自动连接至本地大模型
      </p>
      <button v-if="!unslothAlive && !loading" class="btn btn-primary" @click="openUnsloth()">
        启动 Unsloth 工坊
      </button>
    </div>

    <div v-if="unslothAlive" class="section-head">
      <h2 class="section-title">支持桥接的 Agent</h2>
    </div>

    <div v-if="unslothAlive" class="agent-list">
      <div v-for="agent in AGENTS" :key="agent.id" class="agent-item">
        <div class="agent-left">
          <div class="agent-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
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
            :disabled="starting[agent.id]"
            @click="startAgent(agent.id)"
          >
            {{ starting[agent.id] ? '启动桥接中...' : '启动桥接' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: 32px 40px;
  max-width: 680px;
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
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sub-text {
  font-size: var(--font-xs);
  color: var(--ink3);
  margin-top: 2px;
}

.badge {
  font-size: var(--font-2xs);
  font-weight: var(--font-medium);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
}
.badge-online {
  background: rgba(80, 99, 79, 0.12);
  color: var(--success);
}
.badge-offline {
  background: var(--surface);
  color: var(--ink4);
}
.badge-pending {
  background: rgba(128, 101, 68, 0.12);
  color: var(--warning);
}

.offline-hint {
  font-size: var(--font-xs);
  color: var(--ink3);
  margin: 12px 0 0 0;
}

.btn {
  padding: 6px 14px;
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-primary {
  margin-top: 12px;
  background: var(--signal);
  color: var(--raised);
  border: 1px solid var(--signal);
}
.btn-primary:hover { opacity: 0.9; }
.btn-secondary {
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
}
.btn-secondary:hover {
  border-color: var(--signal);
}

.section-head { margin-bottom: 12px; }
.section-title {
  font-size: var(--font-md);
  font-weight: var(--font-semibold);
  color: var(--ink);
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.agent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.agent-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.agent-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--signal);
}
.agent-info {
  display: flex;
  flex-direction: column;
}
.agent-name {
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  color: var(--ink);
}
.agent-desc {
  font-size: var(--font-xs);
  color: var(--ink3);
}
.started-label {
  font-size: var(--font-xs);
  color: var(--success);
  font-weight: var(--font-medium);
}
</style>