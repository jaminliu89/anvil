<script setup lang="ts">
// 对话页 — Parchment 暖纸设计系统 + 思考折叠 + 守卫状态

import { ref, nextTick, watch, onMounted } from 'vue'
import { useDshStore } from '@/stores/dsh'
import { chat, streamChat, estimate, type GuardedMessage } from '@/services/dsh'

interface UiMessage {
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  elapsed?: number
  cacheRate?: number
  salvaged?: boolean
}

const dshStore = useDshStore()

const messages = ref<UiMessage[]>([])
const input = ref('')
const busy = ref(false)
const thinkOpen = ref<Record<number, boolean>>({})
const estimateHint = ref('')
const listEl = ref<HTMLElement | null>(null)

function scrollBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

watch(messages, scrollBottom, { deep: true })

async function updateEstimate() {
  const text = input.value.trim()
  if (!text || messages.value.length === 0) {
    estimateHint.value = ''
    return
  }
  try {
    const prev = messages.value.map((m) => ({ role: m.role, content: m.content }))
    const est = await estimate(prev, [{ role: 'user', content: text }])
    const rate = (est as { cache_hit_rate?: number }).cache_hit_rate
    if (rate !== undefined) estimateHint.value = `预计缓存命中率 ${(rate * 100).toFixed(0)}%`
  } catch {
    estimateHint.value = ''
  }
}

async function send() {
  const text = input.value.trim()
  if (!text || busy.value) return
  busy.value = true
  estimateHint.value = ''
  input.value = ''

  messages.value.push({ role: 'user', content: text })
  const assistant: UiMessage = { role: 'assistant', content: '' }
  messages.value.push(assistant)

  const history: GuardedMessage[] = messages.value
    .slice(0, -1)
    .map((m) => ({ role: m.role, content: m.content }))

  const t0 = performance.now()
  try {
    await streamChat(
      history,
      {
        onThinking: (t) => {
          assistant.reasoning = (assistant.reasoning || '') + t
          scrollBottom()
        },
        onDelta: (t) => {
          assistant.content += t
          scrollBottom()
        },
        onError: (err) => {
          assistant.content += `\n\n[回答异常] ${err}`
        },
      },
      { maxTokens: 2048 },
    )
  } catch (e) {
    // 流式失败回退非流式
    try {
      const r = await chat(history, { maxTokens: 2048 })
      assistant.content = r.message.content
      assistant.reasoning = r.message.reasoning_content
      assistant.cacheRate = r.usage?.cache_hit_rate
      assistant.salvaged = r.salvaged
    } catch (e2) {
      assistant.content = `[对话遇到问题] ${e2}`
    }
  }
  assistant.elapsed = Number(((performance.now() - t0) / 1000).toFixed(1))
  busy.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

onMounted(() => {
  dshStore.refresh()
})
</script>

<template>
  <div class="view chat-view">
    <div class="msg-list" ref="listEl">
      <div v-if="messages.length === 0" class="empty">
        <div class="empty-badge">Parchment AI Workstation</div>
        <div class="empty-title">与你的本地 AI 对话</div>
        <div class="empty-sub">全过程本地运行 · 数据绝不出本机 · 零 API 费用</div>
      </div>

      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <!-- 思考过程折叠条 -->
        <div v-if="m.reasoning" class="think" @click="thinkOpen[i] = !thinkOpen[i]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4M12 8h.01"></path>
          </svg>
          <span class="think-label">{{ thinkOpen[i] ? '收起思考推演过程' : '展开思考推演过程' }}</span>
        </div>
        <pre v-if="m.reasoning && thinkOpen[i]" class="think-body">{{ m.reasoning }}</pre>

        <div class="bubble">
          <pre class="content">{{ m.content || (busy && i === messages.length - 1 ? '思考中…' : '') }}</pre>
        </div>

        <div v-if="m.role === 'assistant' && m.elapsed" class="meta">
          <span v-if="m.elapsed">耗时 {{ m.elapsed }}s</span>
          <span v-if="m.cacheRate !== undefined">缓存命中 {{ (m.cacheRate * 100).toFixed(0) }}%</span>
          <span v-if="m.salvaged" class="salvage-tag">守卫已自动修补</span>
        </div>
      </div>
    </div>

    <div class="composer">
      <div v-if="estimateHint" class="est">{{ estimateHint }}</div>
      <div class="input-row">
        <textarea
          v-model="input"
          @keydown="onKeydown"
          @input="updateEstimate"
          placeholder="输入消息，Enter 发送，Shift + Enter 换行"
          rows="2"
        ></textarea>
        <button class="send" @click="send" :disabled="busy || !input.trim()">
          {{ busy ? '处理中...' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--canvas);
}

.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
}
.empty-badge {
  font-size: 11px;
  font-weight: var(--font-medium);
  color: var(--signal);
  background: var(--signal-soft);
  padding: 3px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
}
.empty-title {
  font-size: var(--font-xl);
  font-weight: var(--font-bold);
  color: var(--ink);
}
.empty-sub {
  font-size: var(--font-sm);
  color: var(--ink3);
}

.msg {
  margin-bottom: 20px;
  max-width: 82%;
}
.msg.user {
  margin-left: auto;
}

.think {
  font-size: 12px;
  color: var(--ink3);
  cursor: pointer;
  user-select: none;
  margin-bottom: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--line);
}
.think:hover {
  color: var(--ink);
  border-color: var(--signal);
}
.think-label {
  font-size: 11px;
}

.think-body {
  font-size: 12px;
  color: var(--ink2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin: 0 0 8px 0;
  white-space: pre-wrap;
  font-family: inherit;
  max-height: 240px;
  overflow-y: auto;
  line-height: 1.6;
}

.bubble {
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  font-size: var(--font-md);
  line-height: 1.65;
  box-shadow: var(--shadow-sm);
}
.msg.user .bubble {
  background: var(--signal);
  color: var(--raised);
}
.msg.assistant .bubble {
  background: var(--raised);
  border: 1px solid var(--line);
  color: var(--ink);
}

.content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--ink4);
  margin-top: 6px;
}
.salvage-tag {
  color: var(--success);
  font-weight: var(--font-medium);
}

.composer {
  padding: 16px 28px 20px;
  border-top: 1px solid var(--line);
  background: var(--surface);
}
.est {
  font-size: 11px;
  color: var(--signal);
  margin-bottom: 8px;
  font-weight: var(--font-medium);
}
.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: var(--font-base);
  font-family: inherit;
  background: var(--raised);
  color: var(--ink);
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--transition-fast);
}
textarea:focus {
  border-color: var(--signal);
}

.send {
  border: 1px solid var(--signal);
  background: var(--signal);
  color: var(--raised);
  border-radius: var(--radius-md);
  padding: 10px 20px;
  font-size: var(--font-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  height: 42px;
  transition: opacity var(--transition-fast);
}
.send:hover:not(:disabled) {
  opacity: 0.9;
}
.send:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
