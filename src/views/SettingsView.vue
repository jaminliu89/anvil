<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { all } from '@/adapters/registry'
import { getToolsStatus, type ToolStatus } from '@/adapters/health'
import { CODE_FALLBACK_CHAIN, RESEARCH_FALLBACK_CHAIN, CHAT_FALLBACK_CHAIN } from '@/adapters/intent'

const settingsStore = useSettingsStore()

const theme = ref<'light' | 'dark'>('light')
const autostart = ref(true)
const autoLaunchAi = ref(true)
const notifications = ref(true)

const toolStatuses = ref<Record<string, ToolStatus>>({})
const loading = ref(true)
const lastChecked = ref('')

// MCP 服务
const BRIDGE = 'http://127.0.0.1:18443'
interface McpServerInfo {
  name: string
  connected: boolean
  tools_count: number
  error?: string
  command: string
}
const mcpServers = ref<McpServerInfo[]>([])
const mcpBusy = ref(false)

async function refreshMcp() {
  try {
    const res = await fetch(`${BRIDGE}/mcp/servers`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      mcpServers.value = Array.isArray(data) ? data : (data.servers || [])
    }
  } catch {
    // bridge 未启动，保持现状
  }
}

async function toggleMcp(srv: McpServerInfo) {
  mcpBusy.value = true
  try {
    const path = srv.connected ? 'disconnect' : 'connect'
    const res = await fetch(`${BRIDGE}/mcp/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: srv.name }),
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      await refreshMcp()
    }
  } catch {
    // 失败静默
  } finally {
    mcpBusy.value = false
  }
}

async function refreshStatus() {
  loading.value = true
  try {
    toolStatuses.value = await getToolsStatus(true)
    const now = new Date()
    lastChecked.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    // 静默失败
  } finally {
    loading.value = false
  }
}

function getAdapterName(id: string): string {
  const a = all().find(ad => ad.id === id)
  return a?.name || id
}

function statusClass(id: string): string {
  const s = toolStatuses.value[id]
  if (!s) return 'unknown'
  if (s.available && s.healthy) return 'healthy'
  if (s.available) return 'degraded'
  return 'unavailable'
}

function statusText(id: string): string {
  const s = toolStatuses.value[id]
  if (!s) return '检测中...'
  if (s.available && s.healthy) return '正常'
  if (s.available) return s.message || '降级'
  return '不可用'
}

function chainHealth(chain: string[]): 'all-healthy' | 'degraded' | 'all-down' {
  if (Object.keys(toolStatuses.value).length === 0) return 'all-healthy'
  const healthyCount = chain.filter(id => {
    const s = toolStatuses.value[id]
    return s?.available && s?.healthy
  }).length
  if (healthyCount === chain.length) return 'all-healthy'
  if (healthyCount > 0) return 'degraded'
  return 'all-down'
}

function applyTheme(t: 'light' | 'dark') {
  document.documentElement.dataset.theme = t
  settingsStore.theme = t
  settingsStore.save()
}

watch(theme, (t) => applyTheme(t))

onMounted(async () => {
  await settingsStore.load()
  theme.value = settingsStore.theme || 'light'
  applyTheme(theme.value)
  refreshStatus()
  refreshMcp()
  // 每 60 秒自动刷新
  setInterval(refreshStatus, 60_000)
  setInterval(refreshMcp, 60_000)
})
</script>

<template>
  <div class="settings-view">
    <div class="settings">
      <!-- 通用 -->
      <div class="section">
        <div class="section-label">通用</div>
        <div class="setting-list">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">开机自启</span>
              <span class="setting-desc">登录 Mac 后自动打开 Anvil</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="autostart" />
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">自动运行</span>
              <span class="setting-desc">打开 Anvil 后自动启动 AI</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="autoLaunchAi" />
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">通知</span>
              <span class="setting-desc">运行状态变化时发送通知</span>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="notifications" />
              <span class="switch-track"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 外观 -->
      <div class="section">
        <div class="section-label">外观</div>
        <div class="setting-list">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-name">主题</span>
              <span class="setting-desc">亮色 / 暗色</span>
            </div>
            <div class="theme-toggle">
              <button
                class="theme-btn"
                :class="{ active: theme === 'light' }"
                @click="theme = 'light'"
              >亮色</button>
              <button
                class="theme-btn"
                :class="{ active: theme === 'dark' }"
                @click="theme = 'dark'"
              >暗色</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 运行状态 -->
      <div class="section">
        <div class="section-label">
          运行状态
          <span v-if="lastChecked" class="section-meta">{{ lastChecked }} · 点此刷新</span>
        </div>
        <div class="status-list" @click="refreshStatus">
          <!-- 编码链 -->
          <div class="status-chain">
            <div class="chain-header">
              <span class="chain-name">编码</span>
              <span class="chain-dot" :class="chainHealth(CODE_FALLBACK_CHAIN)"></span>
            </div>
            <div class="chain-nodes">
              <template v-for="(id, idx) in CODE_FALLBACK_CHAIN" :key="id">
                <div class="chain-node" :class="statusClass(id)">
                  <span class="node-name">{{ getAdapterName(id) }}</span>
                  <span v-if="settingsStore.advancedMode" class="node-status">{{ statusText(id) }}</span>
                </div>
                <div v-if="idx < CODE_FALLBACK_CHAIN.length - 1" class="chain-arrow"></div>
              </template>
            </div>
          </div>

          <!-- 研究链 -->
          <div class="status-chain">
            <div class="chain-header">
              <span class="chain-name">研究</span>
              <span class="chain-dot" :class="chainHealth(RESEARCH_FALLBACK_CHAIN)"></span>
            </div>
            <div class="chain-nodes">
              <template v-for="(id, idx) in RESEARCH_FALLBACK_CHAIN" :key="id">
                <div class="chain-node" :class="statusClass(id)">
                  <span class="node-name">{{ getAdapterName(id) }}</span>
                  <span v-if="settingsStore.advancedMode" class="node-status">{{ statusText(id) }}</span>
                </div>
                <div v-if="idx < RESEARCH_FALLBACK_CHAIN.length - 1" class="chain-arrow"></div>
              </template>
            </div>
          </div>

          <!-- 聊天链 -->
          <div class="status-chain">
            <div class="chain-header">
              <span class="chain-name">聊天</span>
              <span class="chain-dot" :class="chainHealth(CHAT_FALLBACK_CHAIN)"></span>
            </div>
            <div class="chain-nodes">
              <template v-for="(id, idx) in CHAT_FALLBACK_CHAIN" :key="id">
                <div class="chain-node" :class="statusClass(id)">
                  <span class="node-name">{{ getAdapterName(id) }}</span>
                  <span v-if="settingsStore.advancedMode" class="node-status">{{ statusText(id) }}</span>
                </div>
                <div v-if="idx < CHAT_FALLBACK_CHAIN.length - 1" class="chain-arrow"></div>
              </template>
            </div>
          </div>
        </div>

        <!-- 高级模式：全部 adapter 明细 -->
        <div v-if="settingsStore.advancedMode" class="all-tools">
          <div class="setting-item" v-for="adapter in all()" :key="adapter.id">
            <div class="setting-info">
              <span class="setting-name">{{ adapter.name }}</span>
              <span class="setting-desc">{{ adapter.description }}</span>
            </div>
            <span class="status-badge" :class="statusClass(adapter.id)">{{ statusText(adapter.id) }}</span>
          </div>
        </div>
      </div>

      <!-- MCP 服务 -->
      <div class="section" v-if="settingsStore.advancedMode">
        <div class="section-label">
          MCP 服务
          <span class="section-meta" @click="refreshMcp">刷新</span>
        </div>
        <div class="setting-list">
          <div v-if="mcpServers.length === 0" class="setting-item">
            <div class="setting-info">
              <span class="setting-desc">还没有配置 MCP 服务。通过 bridge /mcp/add 添加。</span>
            </div>
          </div>
          <div class="setting-item" v-for="srv in mcpServers" :key="srv.name">
            <div class="setting-info">
              <span class="setting-name">{{ srv.name }}</span>
              <span class="setting-desc">{{ srv.command }} · {{ srv.tools_count }} 工具</span>
            </div>
            <div class="mcp-actions">
              <span class="status-badge" :class="srv.connected ? 'badge-ok' : 'badge-off'">
                {{ srv.connected ? '已连接' : '未连接' }}
              </span>
              <button
                class="mcp-btn"
                @click="toggleMcp(srv)"
                :disabled="mcpBusy"
              >{{ srv.connected ? '断开' : '连接' }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 关于 -->
      <div class="section">
        <div class="section-label">关于</div>
        <div class="setting-list">
          <div class="setting-item about-item">
            <div class="about-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            <div class="about-info">
              <span class="about-name">Anvil</span>
              <span class="about-ver">v0.2.0</span>
            </div>
            <span class="about-desc">你的本地 AI 工作站</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view { padding: 12px 16px 16px; }

/* 设置分组 */
.settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--ink3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  padding: 0 2px;
}

.setting-list {
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-subtle);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
}

.setting-desc {
  font-size: 11px;
  color: var(--ink3);
}

/* 开关 */
.switch {
  position: relative;
  width: 36px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.switch-track {
  position: absolute;
  inset: 0;
  background: var(--muted);
  border: 1px solid var(--line);
  border-radius: 10px;
  transition: all 150ms ease;
}

.switch input:checked + .switch-track {
  background: var(--signal);
  border-color: var(--signal);
}

.switch-track::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: var(--canvas);
  border-radius: 50%;
  transition: transform 150ms ease;
}

.switch input:checked + .switch-track::after {
  transform: translateX(16px);
}

/* 主题切换 */
.theme-toggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}

.theme-btn {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: none;
  color: var(--ink3);
  background: var(--canvas);
  transition: all 120ms ease;
}

.theme-btn.active {
  color: var(--canvas);
  background: var(--signal);
}

.theme-btn:first-child {
  border-right: 1px solid var(--line);
}

/* 关于 */
.about-item {
  gap: 10px;
}

.about-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--signalSoft);
  color: var(--signal);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.about-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.about-ver {
  font-size: 11px;
  color: var(--ink3);
}

.about-desc {
  font-size: 11px;
  color: var(--ink3);
}

/* 运行状态 */
.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-meta {
  font-size: 10px;
  font-weight: 400;
  color: var(--ink3);
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.7;
}

.status-list {
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
}

.status-chain {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-subtle);
}

.status-chain:last-child {
  border-bottom: none;
}

.chain-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.chain-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink2);
}

.chain-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
}

.chain-dot.all-healthy {
  background: var(--success);
}

.chain-dot.degraded {
  background: var(--warning);
}

.chain-dot.all-down {
  background: var(--error);
}

.chain-nodes {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chain-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--canvas);
  border: 1px solid var(--line-subtle);
  font-size: 11px;
}

.chain-node.healthy {
  border-color: var(--success);
  color: var(--ink);
}

.chain-node.degraded {
  border-color: var(--warning);
  color: var(--ink2);
}

.chain-node.unavailable {
  border-color: var(--error);
  color: var(--ink3);
  opacity: 0.6;
}

.chain-node.unknown {
  border-color: var(--line);
  color: var(--ink3);
}

.node-name {
  font-weight: 500;
}

.node-status {
  font-size: 10px;
  color: var(--ink3);
}

.chain-arrow {
  width: 12px;
  height: 1px;
  background: var(--line-subtle);
  position: relative;
  flex-shrink: 0;
}

.chain-arrow::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  border: 3px solid transparent;
  border-left-color: var(--line-subtle);
}

.all-tools {
  margin-top: 8px;
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
}

.status-badge.healthy {
  background: var(--successSoft);
  color: var(--success);
}

.status-badge.degraded {
  background: var(--warningSoft);
  color: var(--warning);
}

.status-badge.unavailable {
  background: var(--errorSoft);
  color: var(--error);
}

.status-badge.unknown {
  background: var(--muted);
  color: var(--ink3);
}
</style>