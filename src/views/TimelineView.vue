<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import CommandBar from '@/components/CommandBar.vue'
import { registerAllAdapters } from '@/adapters'
import { get, all } from '@/adapters/registry'
import { runAgentLoopStream, type AgentLoopStep } from '@/adapters/dsh-adapter'
import { guessIntent } from '@/adapters/intent'
import type { Parsed } from '@/adapters/parse'
import type { TimelineEntry } from '@/adapters/types'
import { markdownToHtml } from '@/utils/markdown'
import { listConvs, saveConv, loadConv, newConvId } from '@/utils/conv-store'

const BRIDGE = 'http://127.0.0.1:18443'

// 默认用 dsh（agent loop 是万能入口，能调度所有能力）
const DEFAULT_ADAPTER = 'dsh'

const entries = ref<TimelineEntry[]>([])
const currentAdapterId = ref(localStorage.getItem('anvil.adapter') || DEFAULT_ADAPTER)
const messagesEl = ref<HTMLElement | null>(null)
const busy = ref(false)
const autoSearch = ref(localStorage.getItem('anvil.search') !== '0')

const emit = defineEmits<{
  openDrawer: [key: string]
}>()

// agent loop 推理流式累积区
const reasoningRef = ref('')

function persistAdapter(id: string) {
  currentAdapterId.value = id
  localStorage.setItem('anvil.adapter', id)
}

// ===== 任务调度：自动选 agent + 同步/异步分流 =====

/** 走普通聊天（带搜索增强） */
async function runChatWithAdapter(adapterId: string, text: string) {
  const adapter = get(adapterId)
  if (!adapter?.chat) return

  let prompt = text
  if (autoSearch.value) {
    const context = await searchWeb(text)
    if (context) {
      addEntry('system', 'system', { content: '已搜索网络，正在整合结果...' })
      prompt = `以下是联网搜索结果（供你参考，输出时用自然语言组织，必要时在句末标注来源）：\n${context}\n\n用户提问: ${text}`
    }
  }

  const history = entries.value
    .filter(e => e.type === 'message' && e.adapterId === adapterId)
    .slice(0, -1)
    .map(e => ({ role: (e.data.role as 'user' | 'assistant') || 'assistant', content: (e.data.content as string) || '' }))

  try {
    const result = await adapter.chat(history, prompt)
    addEntry('message', adapterId, {
      role: 'assistant', content: result.content, reasoning: result.reasoning,
    })
    persistConv()
  } catch (e) {
    addEntry('system', adapterId, { content: `错误: ${e}` })
  }
}

/** 派发到异步编码 agent（dock / jules / 等）
 *  创建 plan 类型卡片 + 启动状态轮询 + 完成后回填结果
 */
function dispatchAsyncTask(adapterId: string, text: string) {
  const adapter = get(adapterId)
  if (!adapter) {
    // 兜底 dsh
    addEntry('system', 'system', { content: `${adapterId} 暂不可用，由 Agent Loop 接手` })
    addEntry('agent-loop', 'dsh', { title: 'Agent Loop', content: text, status: 'running', steps: [] })
    const loopId = entries.value[entries.value.length - 1].id
    startAgentLoop(text, loopId)
    return
  }

  // 创建异步任务卡片
  addEntry('plan', adapterId, {
    title: text.slice(0, 60),
    content: text,
    status: 'queued',
    steps: [{ id: 's0', title: '排队中...', status: 'running' }],
    sessionId: '',
  })
  const entryId = entries.value[entries.value.length - 1].id

  // 派发 + 轮询
  adapter.execute(adapter.commands?.[0] || adapterId, text).then(result => {
    if (result.type === 'plan') {
      // 从 result.data.status 或 result.approved 判断状态
      const statusFromData = (result.data as Record<string, unknown> | undefined)?.status as string | undefined
      const computedStatus = statusFromData ||
        (result.steps?.some(s => s.status === 'running') ? 'running' :
         result.approved ? 'running' : 'awaiting-approval')

      updateEntryData(entryId, {
        ...result,
        status: computedStatus,
        steps: result.steps?.map(s => ({ ...s, status: s.status || 'pending' })) || [],
      })
      // 启动进度轮询
      if (result.sessionId) {
        startTaskPolling(entryId, adapterId, result.sessionId)
      }
    } else if (result.type === 'system') {
      // 出错了
      updateEntryData(entryId, { status: 'error', error: result.content })
    } else {
      updateEntryData(entryId, { ...result, status: 'done' })
    }
  }).catch(e => {
    updateEntryData(entryId, {
      status: 'error',
      error: `派单失败: ${e}`,
      steps: [{ id: 'err', title: '派单失败', status: 'failed' }],
    })
    // 失败兜底：转 dsh
    addEntry('system', 'system', { content: `${adapter.name} 派单失败，由 Agent Loop 接手` })
    addEntry('agent-loop', 'dsh', { title: 'Agent Loop', content: text, status: 'running', steps: [] })
    const loopId = entries.value[entries.value.length - 1].id
    startAgentLoop(text, loopId)
  })
}

/** 统一调度入口 — 根据意图选最合适的执行方式 */
function dispatchTask(text: string, intent?: ReturnType<typeof guessIntent> | null) {
  const adapterId = intent?.adapterId && intent.adapterId !== 'system'
    ? intent.adapterId
    : DEFAULT_ADAPTER
  const adapter = get(adapterId)

  // 没找到目标 adapter → 兜底 dsh
  if (!adapter) {
    const fallback = get('dsh') || all()[0]
    addEntry('system', 'system', { content: intent?.adapterName ? `${intent.adapterName} 暂不可用，由 Agent Loop 接手` : '正在处理...' })
    addEntry('agent-loop', fallback.id, { title: 'Agent Loop', content: text, status: 'running', steps: [] })
    const loopId = entries.value[entries.value.length - 1].id
    startAgentLoop(text, loopId)
    return
  }

  const hasLoop = adapter.capabilities?.some(c => c.type === 'agent-loop')
  // 有 plan/execute 能力的 = 异步编码 agent，走任务卡片
  const isAsyncCode = adapter.capabilities?.some(c => c.type === 'plan' || c.type === 'execute') &&
    !hasLoop &&
    (intent?.category === 'code' || intent?.category === 'research')

  if (hasLoop) {
    // agent loop = 同步多步
    addEntry('agent-loop', adapterId, { title: 'Agent Loop', content: text, status: 'running', steps: [] })
    const loopId = entries.value[entries.value.length - 1].id
    startAgentLoop(text, loopId)
  } else if (isAsyncCode) {
    // 异步任务（编码/研究类）
    dispatchAsyncTask(adapterId, text)
    busy.value = false  // 异步任务不阻塞输入
  } else if (adapter.chat) {
    // 普通同步聊天
    runChatWithAdapter(adapterId, text)
    busy.value = false
  } else {
    // 啥都不会 → 兜底 dsh
    addEntry('system', 'system', { content: `${adapter.name} 不支持直接聊天，由 Agent Loop 接手` })
    addEntry('agent-loop', 'dsh', { title: 'Agent Loop', content: text, status: 'running', steps: [] })
    const loopId = entries.value[entries.value.length - 1].id
    startAgentLoop(text, loopId)
  }
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

    // 1. 猜意图
    const availableIds = all().map(a => a.id)
    const intent = guessIntent(parsed.text, availableIds)

    // 2. 系统操作：打开抽屉
    if (intent?.action === 'open_drawer' && intent.drawer) {
      addEntry('message', 'system', { role: 'user', content: parsed.text })
      const noun = intent.reason.replace('打开', '').replace('管理', '').replace('查看', '').replace('启动', '')
      addEntry('system', 'system', { content: `好的，打开${noun}。` })
      emit('openDrawer', intent.drawer)
      persistConv()
      busy.value = false
      return
    }

    // 3. 用户消息 + 自动调度
    const displayAdapter = intent?.adapterId && intent.adapterId !== 'system'
      ? intent.adapterId
      : DEFAULT_ADAPTER
    addEntry('message', displayAdapter, { role: 'user', content: parsed.text })
    persistConv()

    // 4. 派任务（同步/异步自动分流，失败自动兜底）
    dispatchTask(parsed.text, intent)
    // 注意：busy 的释放在各执行路径里自己处理
    return
  }

  if (parsed.type === 'error') {
    addEntry('system', 'system', { content: parsed.message })
    busy.value = false
    return
  }

  if (parsed.type === 'builtin') {
    // 意图选择器触发的：切换 adapter 后发送聊天
    if (parsed.command === 'switch_and_chat') {
      const [adapterId, text] = (parsed.args as string).split(':::')
      const target = get(adapterId)
      if (target && text) {
        persistAdapter(adapterId)
        // 直接走聊天逻辑
        addEntry('message', adapterId, { role: 'user', content: text })
        persistConv()

        if (target.chat) {
          const history = entries.value
            .filter(e => e.type === 'message' && e.adapterId === adapterId)
            .slice(0, -1)
            .map(e => ({ role: (e.data.role as 'user' | 'assistant') || 'assistant', content: (e.data.content as string) || '' }))
          try {
            const result = await target.chat(history, text)
            addEntry('message', adapterId, {
              role: 'assistant', content: result.content, reasoning: result.reasoning,
            })
            persistConv()
          } catch (e) {
            addEntry('system', adapterId, { content: `错误: ${e}` })
          }
        } else {
          addEntry('system', adapterId, { content: '当前适配器不支持聊天。' })
        }
      }
      busy.value = false
      return
    }

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
        try {
          const r = await fetch(`${BRIDGE}/target`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: targetId }),
            signal: AbortSignal.timeout(5000),
          })
          const j = await r.json()
          if (j.ok) addEntry('system', 'system', { content: `推理端点 → ${j.switched} (${j.model || 'auto'})` })
        } catch { /* bridge not running, silent */ }
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

    if (result.type === 'agent-loop') {
      const entryId = entries.value[entries.value.length - 1].id
      startAgentLoop(result.content as string, entryId)
    }
  } catch (e) {
    addEntry('system', parsed.adapter.id, { content: `错误: ${e}` })
    busy.value = false
  }
  if (parsed.adapter.id !== 'dsh') {
    busy.value = false
  }
}

// ---- Agent Loop 流式执行 ----
function updateEntryData(id: string, patch: Record<string, unknown>) {
  const idx = entries.value.findIndex(e => e.id === id)
  if (idx >= 0) {
    entries.value[idx] = {
      ...entries.value[idx],
      data: { ...entries.value[idx].data, ...patch },
    }
  }
}

function startAgentLoop(prompt: string, entryId: string) {
  const steps: AgentLoopStep[] = []
  let answerContent = ''

  reasoningRef.value = ''

  updateEntryData(entryId, {
    steps,
    status: 'running',
    answer: '',
    reasoning: '',
  })

  runAgentLoopStream(prompt, {
    onStepStart: (step) => {
      steps.push({ ...step })
      updateEntryData(entryId, { steps: [...steps], status: 'running' })
    },
    onStepUpdate: (stepId, content) => {
      const s = steps.find(s => s.id === stepId)
      if (s) {
        if (stepId === 'answer') {
          answerContent += content
          updateEntryData(entryId, { answer: answerContent })
        } else {
          s.content = (s.content || '') + content
          updateEntryData(entryId, { steps: [...steps] })
        }
      }
    },
    onStepReasoning: (_stepId, content) => {
      reasoningRef.value += content
      updateEntryData(entryId, { reasoning: reasoningRef.value })
    },
    onStepDone: (stepId, status, result) => {
      const s = steps.find(s => s.id === stepId)
      if (s) {
        s.status = status as AgentLoopStep['status']
        s.result = result
        updateEntryData(entryId, { steps: [...steps] })
      }
    },
    onFinal: (content, meta) => {
      updateEntryData(entryId, {
        status: 'done',
        answer: content,
        stepsCount: meta.steps,
        usedSearch: meta.usedSearch,
        reasoning: meta.reasoning || reasoningRef.value,
      })
      busy.value = false
      reasoningRef.value = ''
      persistConv()
    },
    onError: (message) => {
      updateEntryData(entryId, { status: 'error', error: message })
      busy.value = false
      reasoningRef.value = ''
      persistConv()
    },
  }, { search: autoSearch.value })
}
const targetStatus = ref<Record<string, boolean>>({})

async function refreshTargetStatus() {
  try {
    const r = await fetch(`${BRIDGE}/capabilities`, { signal: AbortSignal.timeout(5000) })
    const j = await r.json()
    targetStatus.value = j.target_status || {}
  } catch {}
}

// 直接发送一条消息（空状态建议卡片点击用）
function quickSend(text: string) {
  if (busy.value) return
  busy.value = true

  addEntry('message', currentAdapterId.value, { role: 'user', content: text })
  persistConv()

  const adapter = get(currentAdapterId.value)
  if (adapter?.chat) {
    const history = entries.value
      .filter(e => e.type === 'message' && e.adapterId === currentAdapterId.value)
      .slice(0, -1)
      .map(e => ({ role: (e.data.role as 'user' | 'assistant') || 'assistant', content: (e.data.content as string) || '' }))
    try {
      adapter.chat(history, text).then(result => {
        addEntry('message', currentAdapterId.value, {
          role: 'assistant', content: result.content, reasoning: result.reasoning,
        })
        persistConv()
        busy.value = false
      })
    } catch (e) {
      addEntry('system', currentAdapterId.value, { content: `错误: ${e}` })
      busy.value = false
    }
  } else {
    addEntry('system', currentAdapterId.value, { content: '当前适配器不支持聊天。' })
    busy.value = false
  }
}

onMounted(() => { registerAllAdapters(); refreshTargetStatus() })

// 暴露给父组件
defineExpose({
  loadConv: switchConv,
  newConversation: startNewConv,
})

// 根据 entry 类型返回节点样式类
function getDotClass(entry: TimelineEntry): string {
  if (entry.type === 'message' && entry.data.role === 'user') return 'user'
  if (entry.type === 'system') return 'system'
  if (entry.type === 'agent-loop') {
    const status = entry.data.status as string
    return `loop ${status || ''}`
  }
  return 'agent'
}

// 判断系统消息是否是错误/失败类
function isSystemError(entry: TimelineEntry): boolean {
  const content = String(entry.data.content || '')
  const errorPatterns = ['错误', '失败', '不支持', '未启动', '未就绪', '不行', '无法', '拒绝']
  return errorPatterns.some(p => content.includes(p))
}

// 异步任务状态显示文案
function taskStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'queued': '排队中',
    'running': '执行中',
    'awaiting-approval': '待审批',
    'done': '已完成',
    'failed': '失败',
    'error': '错误',
    'pending': '等待中',
    'approved': '已批准',
  }
  return map[status] || status || '等待中'
}

// 查看任务日志（简单版：弹系统消息）
function viewTaskLog(entry: TimelineEntry) {
  const sid = entry.data.sessionId as string
  if (!sid) return
  const adapter = get(entry.adapterId)
  if (!adapter) return
  adapter.execute('log', sid).then(result => {
    addEntry(result.type, entry.adapterId, result as unknown as Record<string, unknown>)
    persistConv()
  })
}

// ===== 异步任务进度轮询 =====
const pollTimers = new Map<string, ReturnType<typeof setInterval>>()

function startTaskPolling(entryId: string, adapterId: string, sessionId: string) {
  if (!sessionId || pollTimers.has(entryId)) return

  const interval = setInterval(async () => {
    try {
      let state: string | undefined
      let steps: any[] | undefined

      if (adapterId === 'dock') {
        const res = await fetch(`http://127.0.0.1:8710/api/sessions/${sessionId}/activities`, {
          signal: AbortSignal.timeout(5000)
        })
        if (res.ok) {
          const acts = await res.json()
          const doneAct = acts.find((a: any) => a.kind === 'executionComplete')
          const planAct = acts.find((a: any) => a.kind === 'planReady')
          if (doneAct) { state = 'done'; steps = [{ id: 's0', title: '执行完成', status: 'done' }] }
          else if (planAct) { state = 'awaiting-approval'; steps = (planAct.text || '').split('\n').filter(Boolean).map((s: string, i: number) => ({ id: `s${i}`, title: s, status: 'pending' })) }
          else { state = 'running' }
        }
      } else {
        const res = await fetch(`http://127.0.0.1:18443/${adapterId}/status/${sessionId}`, {
          signal: AbortSignal.timeout(5000)
        })
        if (res.ok) {
          const task = await res.json()
          state = task.state
          steps = task.steps
        }
      }

      if (state) {
        updateEntryData(entryId, { status: state, steps: steps || [] })
      }

      if (state === 'done' || state === 'failed' || state === 'error') {
        stopTaskPolling(entryId)
        persistConv()
      }
    } catch { /* retry next tick */ }
  }, 10000)

  pollTimers.set(entryId, interval)
}

function stopTaskPolling(entryId: string) {
  const timer = pollTimers.get(entryId)
  if (timer) { clearInterval(timer); pollTimers.delete(entryId) }
}

import { onUnmounted } from 'vue'
onUnmounted(() => {
  for (const timer of pollTimers.values()) { clearInterval(timer) }
  pollTimers.clear()
})

</script>

<template>
  <div class="timeline-view">
    <div class="timeline-container" ref="messagesEl">
      <!-- 背景时间轴竖线 -->
      <div class="timeline-rail"></div>

      <div v-if="entries.length === 0" class="empty-state">
        <div class="empty-brand">Anvil</div>
        <div class="empty-desc">告诉我你想做什么，我来选工具。</div>
        <div class="empty-suggestions">
          <button class="suggestion-chip" @click="quickSend('帮我分析一下最近的 AI 新闻')">
            <svg class="chip-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span class="chip-text">帮我分析一下最近的 AI 新闻</span>
          </button>
          <button class="suggestion-chip" @click="quickSend('用 Python 写一个快速排序')">
            <svg class="chip-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <span class="chip-text">用 Python 写一个快速排序</span>
          </button>
          <button class="suggestion-chip" @click="quickSend('查一下今天的天气')">
            <svg class="chip-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span class="chip-text">查一下今天的天气</span>
          </button>
        </div>
      </div>

      <!-- Entry 列表 -->
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="tl-entry"
        :class="{
          'tl-entry--user': entry.type === 'message' && entry.data.role === 'user',
          'tl-entry--system': entry.type === 'system',
          'tl-entry--agent-loop': entry.type === 'agent-loop',
        }"
      >
        <!-- 时间轴节点 -->
        <div class="tl-dot" :class="getDotClass(entry)"></div>

        <!-- 内容区 -->
        <div class="tl-content">
          <!-- 系统消息 -->
          <div v-if="entry.type === 'system'" class="system-text"
               :class="{ 'is-error': isSystemError(entry) }">
            <span class="system-adapter">{{ entry.adapterId }}</span>
            <span class="system-content">{{ entry.data.content as string }}</span>
          </div>

          <!-- 普通消息气泡 -->
          <div v-else-if="entry.type === 'message'" class="bubble"
               :class="entry.data.role === 'user' ? 'bubble--user' : 'bubble--agent'">
            <div v-if="entry.data.role !== 'user'" class="bubble-meta">
              <span class="adapter-name">{{ entry.adapterId }}</span>
            </div>
            <div v-if="entry.data.reasoning && entry.data.role !== 'user'" class="reasoning-block">
              <div class="reasoning-toggle"
                   @click="($event.target as HTMLElement).nextElementSibling?.classList.toggle('open')">
                思考过程
              </div>
              <div class="reasoning-body" v-html="markdownToHtml(entry.data.reasoning as string)"></div>
            </div>
            <div class="bubble-content" v-html="markdownToHtml(entry.data.content as string)"></div>
          </div>

          <!-- 异步任务卡片（plan/execution/异步任务） -->
          <div v-else-if="entry.type === 'plan'" class="async-task-card"
               :class="String(entry.data.status || 'pending')">
            <div class="task-header">
              <span class="task-adapter">{{ entry.adapterId }}</span>
              <span class="task-status" :class="String(entry.data.status || 'pending')">
                {{ taskStatusLabel(entry.data.status as string) }}
              </span>
            </div>
            <div v-if="entry.data.title" class="task-title">{{ entry.data.title as string }}</div>
            <div v-if="entry.data.sessionId" class="task-meta">
              session {{ String(entry.data.sessionId).slice(0, 14) }}
              <span v-if="entry.data.branch"> · 分支 {{ entry.data.branch }}</span>
            </div>
            <div v-if="entry.data.steps && (entry.data.steps as unknown[]).length" class="task-steps">
              <div v-for="(step, idx) in (entry.data.steps as { id: string; title: string; status: string; content?: string }[])"
                   :key="step.id" class="task-step" :class="step.status">
                <div class="step-rail">
                  <span class="step-dot" :class="step.status"></span>
                  <span v-if="idx < (entry.data.steps as unknown[]).length - 1" class="step-line"></span>
                </div>
                <div class="step-body">
                  <div class="step-title">{{ step.title }}</div>
                  <div v-if="step.content" class="step-content">{{ step.content }}</div>
                </div>
              </div>
            </div>
            <div v-if="entry.data.error" class="task-error">
              {{ entry.data.error as string }}
            </div>
            <div class="task-actions">
              <button v-if="entry.data.status === 'awaiting-approval' && entry.data.sessionId"
                      class="approve-btn"
                      @click="approvePlan(entry)">
                批准执行
              </button>
              <button v-if="entry.data.status === 'done' && entry.data.sessionId"
                      class="secondary-btn"
                      @click="viewTaskLog(entry)">
                查看日志
              </button>
            </div>
          </div>

          <!-- Agent Loop 任务卡（无框，时间轴式） -->
          <div v-else-if="entry.type === 'agent-loop'" class="loop-block">
            <div class="loop-header">
              <span class="loop-adapter">{{ entry.adapterId }}</span>
              <span class="loop-status" :class="String(entry.data.status)">
                {{ entry.data.status === 'running' ? '运行中' :
                   entry.data.status === 'done' ? '完成' :
                   entry.data.status === 'error' ? '错误' : '...' }}
              </span>
            </div>

            <!-- 步骤时间轴 -->
            <div v-if="entry.data.steps && (entry.data.steps as unknown[]).length" class="loop-steps">
              <div v-for="(step, idx) in (entry.data.steps as { id: string; title: string; status: string; content?: string; result?: unknown }[])"
                   :key="step.id"
                   class="loop-step"
                   :class="step.status">
                <div class="step-rail">
                  <span class="step-dot" :class="step.status"></span>
                  <span v-if="idx < (entry.data.steps as unknown[]).length - 1" class="step-line"></span>
                </div>
                <div class="step-body">
                  <div class="step-title">{{ step.title }}</div>
                  <div v-if="step.content && step.id !== 'answer'" class="step-content">
                    {{ step.content }}
                  </div>
                  <div v-if="step.result && typeof step.result === 'string'" class="step-result">
                    {{ step.result }}
                  </div>
                </div>
              </div>
            </div>

            <!-- reasoning 折叠 -->
            <div v-if="entry.data.reasoning" class="loop-reasoning">
              <div class="reasoning-toggle"
                   @click="($event.target as HTMLElement).nextElementSibling?.classList.toggle('open')">
                思考过程
              </div>
              <div class="reasoning-body" v-html="markdownToHtml(entry.data.reasoning as string)"></div>
            </div>

            <!-- 最终回答 -->
            <div v-if="entry.data.answer" class="loop-answer">
              <div class="answer-label">最终回答</div>
              <div class="answer-body" v-html="markdownToHtml(entry.data.answer as string)"></div>
            </div>

            <!-- 错误 -->
            <div v-if="entry.data.status === 'error' && entry.data.error" class="loop-error">
              {{ entry.data.error as string }}
            </div>
          </div>

          <!-- 训练消息 -->
          <div v-else-if="entry.type === 'train'" class="train-text">
            {{ entry.data.content as string }}
          </div>

          <!-- 其他执行消息 -->
          <div v-else class="exec-text">
            {{ entry.data.content as string }}
          </div>
        </div>
      </div>
    </div>

    <CommandBar :auto-search="autoSearch" @toggle-search="toggleSearch" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.timeline-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--canvas);
}

/* ── 时间轴容器 ── */
.timeline-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0 24px 0;
  position: relative;
  scroll-behavior: smooth;
}

/* 背景竖线 */
.timeline-rail {
  position: absolute;
  left: 52px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--line-subtle);
  pointer-events: none;
  z-index: 0;
}

/* ── Entry 通用 ── */
.tl-entry {
  position: relative;
  display: flex;
  gap: 16px;
  padding: 6px 24px 6px 24px;
  margin-bottom: 4px;
  z-index: 1;
}

.tl-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 48px; /* 52px 中心 - 4px 半宽 = 48px */
  margin-top: 8px;
  background: var(--line);
  border: 2px solid var(--canvas);
  box-sizing: content-box;
  z-index: 2;
  transition: all 150ms ease;
}

.tl-dot.user {
  background: var(--signal);
  /* 用户消息节点也在左边线上，只是颜色不同 */
}

.tl-dot.agent {
  background: var(--ink3);
}

.tl-dot.system {
  width: 4px;
  height: 4px;
  margin-left: 50px;
  margin-top: 11px;
  background: var(--line);
  border: none;
}

.tl-dot.loop {
  background: var(--signal);
  width: 10px;
  height: 10px;
  margin-left: 47px;
  margin-top: 7px;
}

.tl-dot.loop.running {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.tl-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 100px);
}

/* 用户消息靠右，但节点还在左边线上 */
.tl-entry--user .tl-content {
  display: flex;
  justify-content: flex-end;
}

/* ── 空状态 ── */
.empty-state {
  height: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0 40px;
}
.empty-brand {
  font-size: 28px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.01em;
  margin-bottom: 8px;
}
.empty-desc {
  font-size: 13px;
  color: var(--ink3);
  margin-bottom: 28px;
}
.empty-suggestions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 360px;
}
.suggestion-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--canvas);
  color: var(--ink2);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 120ms ease;
  font-family: inherit;
}
.suggestion-chip:hover {
  border-color: var(--ink3);
  background: var(--surface);
  transform: translateY(-1px);
}
.chip-icon {
  flex-shrink: 0;
  color: var(--ink3);
}
.suggestion-chip:hover .chip-icon {
  color: var(--ink2);
}
.chip-text {
  flex: 1;
}

/* ── 系统消息 ── */
.system-text {
  font-size: 12px;
  color: var(--ink3);
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 2px 0;
  line-height: 1.5;
}
.system-adapter {
  color: var(--ink4);
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  font-variant: normal;
}
.system-content {
  color: var(--ink2);
}
.system-text.is-error .system-content {
  color: var(--error);
}

/* 连续系统消息收紧间距 */
.tl-entry--system + .tl-entry--system {
  margin-top: -2px;
}
.tl-entry--system + .tl-entry--system .tl-dot {
  opacity: 0.5;
  width: 4px;
  height: 4px;
  margin-left: 50px;
  margin-top: 11px;
}

/* ── 消息气泡 ── */
.bubble {
  max-width: 85%;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.65;
  border-radius: 12px;
}
.bubble--agent {
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  color: var(--ink2);
  border-top-left-radius: 4px;
}
.bubble--user {
  background: var(--signal);
  color: var(--canvas);
  border-top-right-radius: 4px;
}
.bubble-meta {
  font-size: 11px;
  color: var(--ink3);
  margin-bottom: 4px;
  font-family: var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.bubble--user .bubble-meta {
  color: rgba(255,255,255,0.6);
}
.bubble-content {
  white-space: pre-wrap;
  word-break: break-word;
}

/* reasoning */
.reasoning-block {
  margin-bottom: 8px;
}
.reasoning-toggle {
  font-size: 11px;
  color: var(--ink3);
  cursor: pointer;
  user-select: none;
  border-bottom: 1px dashed var(--line);
  display: inline-block;
  margin-bottom: 4px;
  padding-bottom: 1px;
}
.reasoning-body {
  display: none;
  font-size: 12px;
  color: var(--ink3);
  background: var(--muted);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 4px 0;
  white-space: pre-wrap;
  max-height: 220px;
  overflow-y: auto;
  line-height: 1.55;
}
.reasoning-body.open { display: block; }

/* ── 异步任务卡片 ── */
.async-task-card {
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  padding: 14px 16px;
  max-width: 85%;
}
.async-task-card.error {
  border-color: var(--error);
  background: rgba(120, 75, 70, 0.04);
}
.async-task-card.done {
  border-color: var(--success);
}

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.task-adapter {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.task-status {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--ink3);
}
.task-status.running { color: var(--warning); background: rgba(180, 140, 60, 0.08); }
.task-status.done { color: var(--success); background: rgba(70, 100, 79, 0.08); }
.task-status.error,
.task-status.failed { color: var(--error); background: rgba(120, 75, 70, 0.08); }
.task-status.awaiting-approval { color: var(--signal); background: var(--signalSoft); }
.task-status.queued { color: var(--ink3); background: var(--muted); }

.task-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--ink);
}
.task-meta {
  font-size: 11px;
  color: var(--ink4);
  font-family: var(--mono);
  margin-bottom: 12px;
}

/* 任务步骤时间轴（复用 agent-loop 的 step 样式思路） */
.task-steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}
.task-step {
  display: flex;
  gap: 10px;
  min-height: 22px;
}
.task-step .step-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
}
.task-step .step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink4);
  margin-top: 6px;
  flex-shrink: 0;
}
.task-step.running .step-dot { background: var(--warning); }
.task-step.done .step-dot { background: var(--success); }
.task-step.failed .step-dot { background: var(--error); }
.task-step.pending .step-dot { background: var(--ink4); }
.task-step .step-line {
  width: 1px;
  flex: 1;
  background: var(--line-subtle);
  margin-top: 2px;
}
.task-step .step-body {
  flex: 1;
  padding-bottom: 8px;
}
.task-step .step-title {
  font-size: 13px;
  color: var(--ink2);
  line-height: 1.4;
}
.task-step.running .step-title { color: var(--ink); font-weight: 500; }
.task-step.done .step-title { color: var(--ink2); }
.task-step.pending .step-title { color: var(--ink3); }
.task-step.failed .step-title { color: var(--error); }
.task-step .step-content {
  font-size: 12px;
  color: var(--ink3);
  margin-top: 2px;
  line-height: 1.5;
}

.task-error {
  font-size: 12px;
  color: var(--error);
  padding: 8px 12px;
  background: rgba(120, 75, 70, 0.06);
  border-radius: 6px;
  margin-bottom: 10px;
  line-height: 1.5;
}

.task-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.approve-btn {
  padding: 6px 16px;
  background: var(--signal);
  color: var(--canvas);
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
}
.approve-btn:hover { opacity: 0.9; }
.secondary-btn {
  padding: 6px 14px;
  background: none;
  color: var(--ink2);
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.secondary-btn:hover {
  border-color: var(--ink3);
  color: var(--ink);
}

/* ── Agent Loop 任务卡（时间轴式） ── */
.loop-block {
  max-width: 90%;
  padding-top: 4px;
}

.loop-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.loop-adapter {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.loop-status {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-family: var(--mono);
  background: var(--muted);
  color: var(--ink2);
}
.loop-status.done {
  background: var(--muted);
  color: var(--success);
}
.loop-status.error {
  background: rgba(120, 75, 70, 0.06);
  color: var(--error);
}

/* 步骤时间轴 */
.loop-steps {
  margin-left: 8px;
  margin-bottom: 12px;
  border-left: 1px solid var(--line-subtle);
  padding-left: 16px;
}
.loop-step {
  position: relative;
  padding-bottom: 12px;
  display: flex;
  gap: 10px;
}
.loop-step:last-child {
  padding-bottom: 0;
}
.step-rail {
  position: absolute;
  left: -21px;
  top: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line);
  flex-shrink: 0;
  z-index: 1;
}
.step-dot.running {
  background: var(--signal);
  animation: pulse 1.5s ease-in-out infinite;
}
.step-dot.done {
  background: var(--success);
}
.step-dot.failed {
  background: var(--error);
}
.step-line {
  width: 1px;
  flex: 1;
  min-height: 16px;
  background: var(--line-subtle);
  margin-top: 4px;
}
.step-body {
  flex: 1;
  min-width: 0;
}
.step-title {
  font-size: 13px;
  color: var(--ink2);
  font-weight: 500;
}
.loop-step.done .step-title {
  color: var(--ink3);
}
.step-content {
  font-size: 12px;
  color: var(--ink3);
  margin-top: 4px;
  line-height: 1.5;
}
.step-result {
  font-size: 12px;
  color: var(--success);
  margin-top: 4px;
  font-family: var(--mono);
}

/* loop reasoning */
.loop-reasoning {
  margin: 8px 0 12px;
  padding-left: 8px;
  border-left: 1px solid var(--line-subtle);
}
.loop-reasoning .reasoning-toggle {
  margin-left: 8px;
}
.loop-reasoning .reasoning-body {
  margin-left: 8px;
  display: none;
}
.loop-reasoning .reasoning-body.open {
  display: block;
}

/* 最终回答 */
.loop-answer {
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  padding: 14px 16px;
  margin-top: 8px;
}
.answer-label {
  font-size: 10px;
  font-family: var(--mono);
  color: var(--ink3);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.answer-body {
  font-size: 14px;
  line-height: 1.65;
  color: var(--ink);
}

.loop-error {
  padding: 10px 14px;
  color: var(--error);
  font-size: 12px;
  background: rgba(120, 75, 70, 0.06);
  border-radius: 8px;
  margin-top: 8px;
}

/* 训练消息 */
.train-text {
  font-size: 13px;
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  max-width: 85%;
}

/* 其他执行消息 */
.exec-text {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--surface);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 12px 14px;
  white-space: pre-wrap;
  max-height: 300px;
  overflow: auto;
  max-width: 85%;
}

/* ── Markdown 样式 ── */
.bubble-content :deep(h1), .bubble-content :deep(h2), .bubble-content :deep(h3),
.answer-body :deep(h1), .answer-body :deep(h2), .answer-body :deep(h3) {
  margin: 12px 0 6px;
  font-weight: 600;
  line-height: 1.4;
}
.bubble-content :deep(h1), .answer-body :deep(h1) { font-size: 16px; }
.bubble-content :deep(h2), .answer-body :deep(h2) { font-size: 15px; }
.bubble-content :deep(h3), .answer-body :deep(h3) { font-size: 14px; }
.bubble-content :deep(p), .answer-body :deep(p) { margin: 6px 0; }
.bubble-content :deep(ul), .bubble-content :deep(ol),
.answer-body :deep(ul), .answer-body :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}
.bubble-content :deep(li), .answer-body :deep(li) { margin: 2px 0; }
.bubble-content :deep(code), .answer-body :deep(code) {
  background: var(--muted);
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 12px;
  font-family: var(--mono);
}
.bubble--user .bubble-content :deep(code) {
  background: rgba(255,255,255,0.15);
  border-color: rgba(255,255,255,0.2);
  color: var(--canvas);
}
.bubble-content :deep(pre), .answer-body :deep(pre) {
  background: var(--muted);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  margin: 8px 0;
}
.bubble-content :deep(pre code), .answer-body :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
}
.bubble-content :deep(blockquote), .answer-body :deep(blockquote) {
  border-left: 3px solid var(--line);
  padding: 4px 12px;
  margin: 8px 0;
  color: var(--ink3);
  font-style: italic;
}
.bubble-content :deep(a), .answer-body :deep(a) {
  color: var(--signal);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.bubble--user .bubble-content :deep(a) {
  color: var(--canvas);
}
.bubble-content :deep(hr), .answer-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--line);
  margin: 12px 0;
}

.reasoning-body :deep(p) { margin: 4px 0; }
</style>
