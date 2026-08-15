<script setup lang="ts">
// 对话页 — 所有消息经守卫，思考过程折叠展示

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
    if (rate !== undefined) estimateHint.value = `预计命中缓存 ${(rate * 100).toFixed(0)}%`
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
          assistant.content += `\n\n[出错] ${err}`
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
      assistant.content = `[出错] ${e2}`
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
        <div class="empty-title">和你的本地 AI 说话</div>
        <div class="empty-sub">全部本地运行 · 不联网 · 不留痕</div>
      </div>

      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <!-- 思考折叠条 -->
        <div v-if="m.reasoning" class="think" @click="thinkOpen[i] = !thinkOpen[i]">
          <span class="think-label">{{ thinkOpen[i] ? '收起思考' : '展开思考' }}</span>
        </div>
        <pre v-if="m.reasoning && thinkOpen[i]" class="think-body">{{ m.reasoning }}</pre>

        <div class="bubble">
          <pre class="content">{{ m.content || (busy && i === messages.length - 1 ? '…' : '') }}</pre>
        </div>

        <div v-if="m.role === 'assistant' && m.elapsed" class="meta">
          <span v-if="m.elapsed">{{ m.elapsed }}s</span>
          <span v-if="m.cacheRate !== undefined">缓存 {{ (m.cacheRate * 100).toFixed(0) }}%</span>
          <span v-if="m.salvaged">已修复</span>
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
          placeholder="输入消息，Enter 发送"
          rows="2"
        ></textarea>
        <button class="send" @click="send" :disabled="busy || !input.trim()">{{ busy ? '…' : '发送' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.empty-title { font-size: 18px; font-weight: 600; color: var(--ink); }
.empty-sub { font-size: 13px; color: var(--ink3); }

.msg { margin-bottom: 16px; max-width: 78%; }
.msg.user { margin-left: auto; }

.think {
  font-size: 12px;
  color: var(--ink4);
  cursor: pointer;
  user-select: none;
  margin-bottom: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.think-label { border-bottom: 1px dashed var(--ink4); padding-bottom: 1px; }

.think-body {
  font-size: 12px;
  color: var(--ink3);
  background: var(--signal-soft);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0 0 6px 0;
  white-space: pre-wrap;
  font-family: var(--font-ui);
  max-height: 220px;
  overflow-y: auto;
}

.bubble {
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.65;
}
.msg.user .bubble { background: var(--signal); color: var(--paper); }
.msg.assistant .bubble { background: var(--raised); border: 1px solid var(--line); color: var(--ink2); }

.content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--ink4);
  margin-top: 4px;
}

.composer { padding: 12px 20px 16px; border-top: 1px solid var(--line); }
.est { font-size: 11px; color: var(--ink4); margin-bottom: 6px; }
.input-row { display: flex; gap: 10px; align-items: flex-end; }

textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  background: var(--raised);
  color: var(--ink);
  outline: none;
}
textarea:focus { border-color: var(--signal); }

.send {
  border: none;
  background: var(--signal);
  color: var(--paper);
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.send:disabled { opacity: 0.4; cursor: default; }
</style>
