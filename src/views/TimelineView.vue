<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import CommandBar from '@/components/CommandBar.vue'
import { registerAllAdapters } from '@/adapters'
import { get, all } from '@/adapters/registry'
import type { Parsed } from '@/adapters/parse'
import type { TimelineEntry } from '@/adapters/types'

onMounted(() => { registerAllAdapters() })

const entries = ref<TimelineEntry[]>([])
const currentAdapterId = ref('ling')
const messagesEl = ref<HTMLElement | null>(null)
const busy = ref(false)

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

    const adapter = get(currentAdapterId.value)
    if (adapter?.chat) {
      const history = entries.value
        .filter(e => e.type === 'message' && e.adapterId === currentAdapterId.value)
        .slice(0, -1)
        .map(e => ({ role: (e.data.role as 'user' | 'assistant') || 'assistant', content: (e.data.content as string) || '' }))

      try {
        const result = await adapter.chat(history, parsed.text)
        addEntry('message', currentAdapterId.value, {
          role: 'assistant', content: result.content, reasoning: result.reasoning,
        })
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
      const target = get(targetId)
      if (target) {
        currentAdapterId.value = targetId
        addEntry('system', targetId, { content: `已切换到 ${target.name}` })
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
        <div class="empty-sub">打字聊天，斜杠调工具。/switch <适配器> 切换聊天引擎。</div>
      </div>

      <div v-for="entry in entries" :key="entry.id" class="entry"
           :class="[entry.type === 'message' && entry.data.role === 'user' ? 'entry-right' : 'entry-left']">

        <div v-if="entry.type === 'system'" class="system-msg">{{ entry.data.content }}</div>

        <div v-else-if="entry.type === 'message'" class="bubble"
             :class="entry.data.role === 'user' ? 'bubble-user' : 'bubble-agent'">
          <div v-if="entry.data.reasoning && entry.data.role !== 'user'"
               class="think-toggle"
               @click="($event.target as HTMLElement).nextElementSibling?.classList.toggle('visible')">
            展开思考</div>
          <div v-if="entry.data.reasoning && entry.data.role !== 'user'" class="reasoning">{{ entry.data.reasoning }}</div>
          <div class="content">{{ entry.data.content }}</div>
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

    <CommandBar @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.timeline-view { display: flex; flex-direction: column; height: 100%; }
.messages { flex: 1; overflow-y: auto; padding: 24px; }
.empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.empty-title { font-size: 18px; font-weight: 600; color: var(--ink); }
.empty-sub { font-size: 13px; color: var(--ink3); }
.entry { margin-bottom: 16px; max-width: 78%; }
.entry-left { margin-right: auto; }
.entry-right { margin-left: auto; }
.bubble { border-radius: 12px; padding: 10px 14px; font-size: 14px; line-height: 1.65; }
.bubble-user { background: var(--signal); color: var(--canvas); }
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
.plan-approved { font-size: 12px; color: var(--success); margin-top: 12px; }
</style>