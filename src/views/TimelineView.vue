<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import CommandBar from '@/components/CommandBar.vue'
import { registerAllAdapters } from '@/adapters'
import { get, all } from '@/adapters/registry'
import type { Parsed } from '@/adapters/parse'
import type { TimelineEntry } from '@/adapters/types'
import { markdownToHtml } from '@/utils/markdown'
import { listConvs, saveConv, loadConv, deleteConv, newConvId } from '@/utils/conv-store'

onMounted(() => { registerAllAdapters() })

const BRIDGE = 'http://127.0.0.1:18443'

const entries = ref<TimelineEntry[]>([])
const currentAdapterId = ref(localStorage.getItem('anvil.adapter') || 'ling')
const messagesEl = ref<HTMLElement | null>(null)
const busy = ref(false)
const autoSearch = ref(localStorage.getItem('anvil.search') === '1')

function persistAdapter(id: string) {
  currentAdapterId.value = id
  localStorage.setItem('anvil.adapter', id)
}

const convId = ref(localStorage.getItem('anvil.conv.current') || newConvId())
const convList = ref(listConvs())

function startNewConv() {
  convId.value = newConvId()
  entries.value = []
  localStorage.setItem('anvil.conv.current', convId.value)
}

function switchConv(id: string) {
  const loaded = loadConv(id)
  if (loaded) {
    convId.value = id
    entries.value = loaded
    localStorage.setItem('anvil.conv.current', id)
  }
}

function removeConv(id: string) {
  deleteConv(id)
  convList.value = listConvs()
  if (convId.value === id) startNewConv()
}

function persistConv() {
  const firstUser = entries.value.find(e => e.type === 'message' && e.data.role === 'user')
  const title = firstUser ? String(firstUser.data.content).slice(0, 30) : '新对话'
  saveConv(convId.value, title, entries.value)
  convList.value = listConvs()
}

function toggleSearch() {
  autoSearch.value = !autoSearch.value
  localStorage.setItem('anvil.search', autoSearch.value ? '1' : '0')
}

async function searchWeb(query: string): Promise<string> {
  try {
    const res = await fetch(`${BRIDGE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, count: 5 }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ''
    const json = await res.json()
    const results = json.results || []
    if (results.length === 0) return ''
    return results.map((r: { title?: string; url?: string; content?: string }, i: number) =>
      `[${i + 1}] ${r.title || ''}\n来源: ${r.url || ''}\n${(r.content || '').slice(0, 400)}`
    ).join('\n\n')
  } catch {
    return ''
  }
}

function scrollBottom() {
  nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  })
}

function addEntry(type: TimelineEntry['type'], adapterId: string, data: Record<string, unknown>) {
  entries.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    adapterId,
    type,
    data,
  })
  scrollBottom()
}

async function approvePlan(entry: TimelineEntry) {
  const sid = entry.data.sessionId as string
  if (!sid) return
  busy.value = true
  addEntry('system', 'dock', { content: `/dock approve ${sid}` })
  try {
    const dock = get('dock')
    if (dock) {
      const r = await dock.execute('dock', `approve ${sid}`)
      addEntry(r.type, 'dock', r as unknown as Record<string, unknown>)
    }
  } catch (e) {
    addEntry('system', 'dock', { content: `错误: ${e}` })
  }
  busy.value = false
}

async function handleSubmit(parsed: Parsed) {
  if (busy.value) return
  busy.value = true

  if (parsed.type === 'chat') {
    if (!parsed.text) { busy.value = false; return }
    addEntry('message', currentAdapterId.value, { role: 'user', content: parsed.text })
    persistConv()

    let prompt = parsed.text
    if (autoSearch.value) {
      const context = await searchWeb(parsed.text)
      if (context) {
        addEntry('system', 'system', { content: '🔍 已搜索网络，正在整合结果...' })
        prompt = `以下是联网搜索结果（供你参考，输出时用自然语言组织，必要时在句末标注来源）：\n${context}\n\n用户提问: ${parsed.text}`
      }
    }

    const adapter = get(currentAdapterId.value)
    if (adapter?.chat) {
      const history = entries.value
        .filter(e => e.type === 'message' && e.adapterId === currentAdapterId.value)
        .slice(0, -1)
        .map(e => ({ role: (e.data.role as 'user' | 'assistant') || 'assistant', content: (e.data.content as string) || '' }))

      try {
        const result = await adapter.chat(history, prompt)
        addEntry('message', currentAdapterId.value, {
          role: 'assistant', content: result.content, reasoning: result.reasoning,
        })
        persistConv()
      } catch (e) {
        addEntry('system', currentAdapterId.value, { content: `错误: ${e}` })
      }
    } else {
      addEntry('system', currentAdapterId.value, { content: '当前适配器不支持聊天。输入 /switch <name> 切换。' })
    }
    busy.value = false
    return
  }

  if (parsed.type === 'error') {
    addEntry('system', 'system', { content: parsed.message })
    busy.value = false
    return
  }

  if (parsed.type === 'builtin') {
    if (parsed.command === 'switch') {
      const targetId = parsed.args
      if (!targetId) {
        const names = all().map(a => a.id).join(', ')
        addEntry('system', 'system', { content: `可用适配器: ${names}。输入 /switch <id> 切换。` })
        busy.value = false
        return
      }
      const target = get(targetId)
      if (target) {
        persistAdapter(targetId)
        addEntry('system', targetId, { content: `已切换到 ${target.name}` })
        persistConv()
      } else {
        const names = all().map(a => a.id).join(', ')
        addEntry('system', 'system', { content: `未知适配器: ${targetId}。可用: ${names}` })
      }
    }
    busy.value = false
    return
  }

  // type === 'command'
  addEntry('system', parsed.adapter.id, { content: `/${parsed.command} ${parsed.args}` })
  try {
    const result = await parsed.adapter.execute(parsed.command, parsed.args)
    addEntry(result.type, parsed.adapter.id, result as unknown as Record<string, unknown>)
    persistConv()
  } catch (e) {
    addEntry('system', parsed.adapter.id, { content: `错误: ${e}` })
  }
  busy.value = false
}
</script>

<template>
  <div class="timeline-view">
    <div class="messages" ref="messagesEl">
      <div v-if="entries.length === 0" class="empty-state">
        <div class="empty-title">Anvil</div>
        <div class="empty-sub">打字聊天，斜杠调工具。/switch [id] 切换聊天引擎。</div>
        <div class="empty-hints">
          <div class="hint-text">/dock 帮我重构这个工具函数 → 起一个异步编码 session</div>
          <div class="hint-text">/switch ling → 切换聊天引擎到 Ling</div>
          <div class="hint-text">🌐 点联网搜索 → 每次提问自动搜索网络</div>
        </div>
      </div>

      <div v-for="entry in entries" :key="entry.id" class="entry"
           :class="[entry.type === 'message' && entry.data.role === 'user' ? 'entry-right' : 'entry-left']">

        <div v-if="entry.type === 'system'" class="system-msg">{{ entry.data.content }}</div>

        <div v-else-if="entry.type === 'message'" class="bubble"
             :class="entry.data.role === 'user' ? 'bubble-user' : 'bubble-agent'">
          <div v-if="entry.data.role !== 'user'" class="model-label">{{ entry.adapterId }}</div>
          <div v-if="entry.data.reasoning && entry.data.role !== 'user'"
               class="think-toggle"
               @click="($event.target as HTMLElement).nextElementSibling?.classList.toggle('visible')">
            展开思考</div>
          <div v-if="entry.data.reasoning && entry.data.role !== 'user'" class="reasoning" v-html="markdownToHtml(entry.data.reasoning as string)"></div>
          <div class="message-row">
            <div v-if="entry.data.role === 'user'" class="content">{{ entry.data.content }}</div>
            <div v-else class="content" v-html="markdownToHtml(entry.data.content as string)"></div>
            <div v-if="entry.data.role === 'user'" class="user-avatar">{{ (entry.data.content as string).charAt(0).toUpperCase() }}</div>
          </div>
        </div>

        <div v-else-if="entry.type === 'plan'" class="plan-card">
          <div v-if="entry.data.title" class="plan-title">{{ entry.data.title }}</div>
          <div v-if="entry.data.sessionId" class="plan-meta">session {{ String(entry.data.sessionId).slice(0, 14) }} · 分支 {{ entry.data.branch }}</div>
          <div v-if="entry.data.steps" class="plan-steps">
            <div v-for="step in (entry.data.steps as { id: string; title: string; status: string }[])" :key="step.id" class="plan-step">
              <span class="step-status" :class="step.status"></span>
              <span>{{ step.title }}</span>
            </div>
          </div>
          <button v-if="entry.data.sessionId && !entry.data.approved" class="approve-btn" @click="entry.data.approved = true; approvePlan(entry)">
            批准执行
          </button>
          <div v-else-if="entry.data.approved" class="plan-approved">已批准，执行中</div>
        </div>

        <div v-else-if="entry.type === 'train'" class="train-msg">{{ entry.data.content }}</div>

        <div v-else class="exec-msg">{{ entry.data.content }}</div>
      </div>
    </div>

    <div class="search-toggle">
      <button class="search-btn" @click="startNewConv">+ 新对话</button>
      <select class="conv-select" @change="switchConv(($event.target as HTMLSelectElement).value)">
        <option value="" disabled selected>历史对话 ({{ convList.length }})</option>
        <option v-for="c in convList" :key="c.id" :value="c.id">
          {{ c.title }} · {{ new Date(c.updatedAt).toLocaleDateString() }}
        </option>
      </select>
      <button v-if="convList.length" class="search-btn" @click="removeConv(convId)">删除当前</button>
      <button class="search-btn" :class="{ active: autoSearch }" @click="toggleSearch()">
        联网搜索
      </button>
      <span class="search-hint">{{ autoSearch ? '每次聊天自动搜索网络' : '关闭' }}</span>
    </div>
    <CommandBar @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.timeline-view { display: flex; flex-direction: column; height: 100%; }
.messages { flex: 1; overflow-y: auto; padding: 24px; }
.empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.empty-title { font-size: 18px; font-weight: 600; color: var(--ink); }
.empty-sub { font-size: 13px; color: var(--ink3); }
.entry { margin-bottom: 16px; max-width: 78%; width: fit-content; min-width: 160px; }
.entry-left { margin-right: auto; }
.entry-right { margin-left: auto; }
.bubble { border-radius: 12px; padding: 10px 14px; font-size: 14px; line-height: 1.65; width: fit-content; }
.bubble-user { background: var(--signal); color: var(--canvas); }
.dark .bubble-user, [data-theme="dark"] .bubble-user { background: #D4D4D4; color: #141415; }
.bubble-agent { background: var(--surface); border: 1px solid var(--line); color: var(--ink2); }
.think-toggle { font-size: 12px; color: var(--ink4); cursor: pointer; user-select: none; border-bottom: 1px dashed var(--ink4); display: inline-block; margin-bottom: 4px; padding-bottom: 1px; }
.reasoning { display: none; font-size: 12px; color: var(--ink3); background: var(--signalSoft); border-radius: 8px; padding: 10px 12px; margin: 6px 0; white-space: pre-wrap; max-height: 220px; overflow-y: auto; }
.reasoning.visible { display: block; }
.content { white-space: pre-wrap; word-break: break-word; }
.system-msg { text-align: center; font-size: 12px; color: var(--ink3); margin: 12px 0; font-family: var(--mono); }
.exec-msg { font-family: var(--mono); font-size: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px; white-space: pre-wrap; max-height: 300px; overflow: auto; margin: 8px 0; }
.train-msg { font-size: 13px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
.plan-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
.plan-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; color: var(--ink); }
.plan-meta { font-size: 11px; color: var(--ink4); font-family: var(--mono); margin-bottom: 12px; }
.plan-steps { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.plan-step { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink2); }
.step-status { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.step-status.pending { background: var(--ink4); }
.step-status.approved { background: var(--success); }
.step-status.done { background: var(--success); }
.step-status.running { background: var(--warning); }
.approve-btn { padding: 6px 16px; background: var(--signal); color: var(--canvas); border: none; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; margin-top: 12px; }
.approve-btn:hover { opacity: 0.9; }
.dark .approve-btn, [data-theme="dark"] .approve-btn { background: #D4D4D4; color: #141415; }
.plan-approved { font-size: 12px; color: var(--success); margin-top: 12px; }

/* 搜索开关条 — 放在 CommandBar 上方 */
.search-toggle { display: flex; align-items: center; gap: 8px; padding: 6px 24px; border-bottom: 1px solid var(--line); }
.search-btn {
  padding: 4px 14px; font-size: 11px; font-family: var(--mono);
  border: 1px solid var(--line); border-radius: var(--radius-sm); cursor: pointer;
  background: var(--surface); color: var(--ink3);
  transition: all var(--duration-micro);
}
.search-btn.active { background: var(--signal); color: var(--canvas); border-color: var(--signal); }
.search-hint { font-size: 11px; color: var(--ink4); }
.conv-select {
  font-size: 11px; font-family: var(--mono); color: var(--ink3);
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm);
  padding: 4px 8px; max-width: 220px; cursor: pointer;
}

/* 助手消息 markdown 排版 */
.content :deep(h1), .content :deep(h2), .content :deep(h3) { margin: 12px 0 6px; font-weight: 600; line-height: 1.4; }
.content :deep(h1) { font-size: 16px; }
.content :deep(h2) { font-size: 15px; }
.content :deep(h3) { font-size: 14px; }
.content :deep(p) { margin: 6px 0; }
.content :deep(ul), .content :deep(ol) { margin: 6px 0; padding-left: 20px; }
.content :deep(li) { margin: 2px 0; }
.content :deep(code) { background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; font-size: 12px; font-family: var(--mono); }
.content :deep(pre) { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow-x: auto; margin: 8px 0; }
.content :deep(pre code) { background: none; border: none; padding: 0; }
.content :deep(blockquote) { border-left: 3px solid var(--line); padding: 4px 12px; margin: 8px 0; color: var(--ink3); font-style: italic; }
.content :deep(a) { color: var(--signal); text-decoration: underline; }
.content :deep(hr) { border: none; border-top: 1px solid var(--line); margin: 12px 0; }

</style>