<script setup lang="ts">
import { ref } from 'vue'

interface Tool {
  id: string
  name: string
  desc: string
  connected: boolean
  since: string
}

const tools = ref<Tool[]>([
  { id: 'browser', name: '浏览器', desc: '联网搜索、抓取网页内容', connected: true, since: '2 小时 15 分钟' },
  { id: 'files', name: '文件', desc: '读取和编辑本地文件', connected: true, since: '2 小时 15 分钟' },
  { id: 'code', name: '代码', desc: '运行代码片段', connected: false, since: '' },
  { id: 'image', name: '图像', desc: '生成和识别图片', connected: false, since: '' },
])

function toggleTool(id: string) {
  const tool = tools.value.find(t => t.id === id)
  if (!tool) return
  tool.connected = !tool.connected
  if (tool.connected) {
    tool.since = '刚刚'
  } else {
    tool.since = ''
  }
}
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">连接</h1>
      <p class="page-sub">管理 AI 可调用的外部工具</p>
    </div>

    <div class="section">
      <div class="summary">
        <span class="summary-count">已连接 {{ tools.filter(t => t.connected).length }} / {{ tools.length }}</span>
      </div>
    </div>

    <div class="tool-list">
      <div
        v-for="tool in tools"
        :key="tool.id"
        class="tool-item"
      >
        <div class="tool-left">
          <span class="tool-dot" :class="{ online: tool.connected }"></span>
          <div class="tool-info">
            <span class="tool-name">{{ tool.name }}</span>
            <span class="tool-desc">{{ tool.desc }}</span>
          </div>
        </div>
        <div class="tool-right">
          <span v-if="tool.connected" class="tool-since">{{ tool.since }}</span>
          <button
            class="toggle-btn"
            :class="{ connected: tool.connected }"
            @click="toggleTool(tool.id)"
          >
            {{ tool.connected ? '断开' : '连接' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: var(--space-8) var(--space-8);
  max-width: 600px;
}

.page-head {
  margin-bottom: var(--space-6);
}

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

.section {
  margin-bottom: var(--space-4);
}

.summary {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
  letter-spacing: 0.03em;
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--color-border-soft);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.tool-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  transition: background var(--transition-fast);
}

.tool-item:hover {
  background: var(--color-bg-tertiary);
}

.tool-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.tool-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: all var(--transition-base);
}

.tool-dot.online {
  background: var(--color-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 20%, transparent);
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.tool-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--color-text);
}

.tool-desc {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.tool-since {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.toggle-btn {
  height: 26px;
  padding: 0 var(--space-3);
  font-size: var(--font-2xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
  border: 1px solid var(--color-border-soft);
  background: var(--color-bg);
  color: var(--color-signal);
}

.toggle-btn:hover {
  border-color: var(--color-border);
  background: var(--color-bg-tertiary);
}

.toggle-btn.connected {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  border-color: var(--color-border-soft);
}

.toggle-btn.connected:hover {
  color: var(--color-error);
  border-color: color-mix(in srgb, var(--color-error) 30%, var(--color-border-soft));
}
</style>