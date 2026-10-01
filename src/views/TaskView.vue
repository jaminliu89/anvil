<script setup lang="ts">
import { computed, ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { approveCodingPlan, createCodingPlan, getCodingWorkerStatus } from '@/runtime/coding-worker'

const repoPath = ref(localStorage.getItem('anvil.vs001.repo') || '')
const taskText = ref('')
const state = ref<'idle' | 'ready' | 'planning' | 'awaiting-approval' | 'approving' | 'executing' | 'error'>(repoPath.value ? 'ready' : 'idle')
const error = ref('')
const sessionId = ref('')
const branch = ref('')
const planSteps = ref<string[]>([])
const workerStatus = ref('未检查')

const canRun = computed(() => Boolean(repoPath.value && taskText.value.trim()) && ['idle', 'ready', 'error'].includes(state.value))

async function chooseRepository() {
  error.value = ''
  try {
    const selected = await open({ directory: true, multiple: false, title: '选择要处理的代码仓库' })
    if (typeof selected === 'string' && selected) {
      repoPath.value = selected
      localStorage.setItem('anvil.vs001.repo', selected)
      state.value = 'ready'
    }
  } catch (e) {
    state.value = 'error'
    error.value = `无法选择仓库：${String(e)}`
  }
}

async function createTask() {
  error.value = ''
  if (!repoPath.value || !taskText.value.trim()) return

  state.value = 'planning'
  planSteps.value = []
  sessionId.value = ''
  branch.value = ''

  const health = await getCodingWorkerStatus()
  workerStatus.value = health.message
  if (!health.available) {
    state.value = 'error'
    error.value = 'Coding Worker 当前不可用。Anvil 没有假装任务已经开始执行。'
    return
  }

  try {
    const plan = await createCodingPlan({ repo: repoPath.value, intent: taskText.value.trim() })
    sessionId.value = plan.sessionId
    branch.value = plan.branch
    planSteps.value = plan.steps
    state.value = 'awaiting-approval'
  } catch (e) {
    state.value = 'error'
    error.value = `计划创建失败：${String(e)}`
  }
}

async function approvePlan() {
  if (!sessionId.value || state.value !== 'awaiting-approval') return
  error.value = ''
  state.value = 'approving'

  const result = await approveCodingPlan(sessionId.value)
  if (result.ok) {
    state.value = 'executing'
    return
  }

  // Critical rule: failed backend approval must return to actionable UI state.
  state.value = 'awaiting-approval'
  error.value = result.message
}

function resetTask() {
  taskText.value = ''
  sessionId.value = ''
  branch.value = ''
  planSteps.value = []
  workerStatus.value = '未检查'
  state.value = repoPath.value ? 'ready' : 'idle'
  error.value = ''
}
</script>

<template>
  <div class="task-view">
    <div class="hero">
      <div class="eyebrow">ANVIL · VS-001</div>
      <h1>你想让这个仓库发生什么变化？</h1>
      <p>选择仓库，用自然语言描述任务。Run 会真实请求 Coding Worker；如果 Worker 不可用，Anvil 会明确失败，而不是制造“正在执行”的假状态。</p>
    </div>

    <section class="workspace-card">
      <div class="field-head">
        <div>
          <div class="label">仓库</div>
          <div class="hint">选择一个本机代码仓库</div>
        </div>
        <button class="secondary" @click="chooseRepository" :disabled="state === 'planning' || state === 'approving' || state === 'executing'">{{ repoPath ? '更换仓库' : '选择仓库' }}</button>
      </div>
      <div class="repo-path" :class="{ empty: !repoPath }">{{ repoPath || '尚未选择' }}</div>
    </section>

    <section class="workspace-card">
      <div class="label">任务</div>
      <textarea
        v-model="taskText"
        :disabled="['planning','awaiting-approval','approving','executing'].includes(state)"
        placeholder="例如：修复登录后偶发回到登录页的问题，并确保现有测试不回退。"
        rows="7"
      />

      <div v-if="error" class="error-box">{{ error }}</div>

      <div v-if="['idle','ready','error'].includes(state)" class="actions">
        <div class="readiness">
          <span :class="['dot', repoPath ? 'ok' : '']"></span>
          {{ repoPath ? '仓库已就绪' : '等待选择仓库' }}
        </div>
        <button class="primary" :disabled="!canRun" @click="createTask">Run</button>
      </div>

      <div v-else class="task-state">
        <div class="state-head">
          <div>
            <div class="label">任务状态</div>
            <div class="hint">{{ workerStatus }}</div>
          </div>
          <button class="secondary" @click="resetTask" :disabled="state === 'planning' || state === 'approving' || state === 'executing'">新建任务</button>
        </div>

        <div class="status-line">
          <span class="status-dot" :class="state"></span>
          <strong v-if="state === 'planning'">正在请求计划…</strong>
          <strong v-else-if="state === 'awaiting-approval'">计划已就绪，等待你批准</strong>
          <strong v-else-if="state === 'approving'">正在确认审批…</strong>
          <strong v-else-if="state === 'executing'">后端已确认审批，任务进入执行</strong>
        </div>

        <div v-if="sessionId" class="meta-grid">
          <div><span>Session</span><strong>{{ sessionId }}</strong></div>
          <div v-if="branch"><span>Branch</span><strong>{{ branch }}</strong></div>
        </div>

        <div v-if="planSteps.length" class="plan-card">
          <div class="label">计划</div>
          <ol>
            <li v-for="step in planSteps" :key="step">{{ step }}</li>
          </ol>
          <button v-if="state === 'awaiting-approval'" class="primary" @click="approvePlan">批准执行</button>
          <button v-else-if="state === 'approving'" class="primary" disabled>审批中…</button>
        </div>

        <div v-if="state === 'executing'" class="next-note">下一刀会接真实执行事件、测试、Diff 与 Accept/Reject；当前只在 Dock 后端确认审批成功后显示“执行中”。</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.task-view { width: min(860px, calc(100% - 48px)); margin: 0 auto; padding: 56px 0 80px; }
.hero { margin-bottom: 28px; }
.eyebrow { font-size: 11px; letter-spacing: .12em; color: var(--color-text-tertiary); margin-bottom: 10px; }
h1 { margin: 0 0 10px; font-size: 28px; line-height: 1.25; color: var(--color-text-primary); font-weight: 650; }
.hero p { margin: 0; max-width: 720px; font-size: 14px; line-height: 1.7; color: var(--color-text-secondary); }
.workspace-card { border: 1px solid var(--color-border-soft); background: var(--color-bg-secondary); border-radius: 14px; padding: 20px; margin-top: 14px; }
.field-head, .actions, .state-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.label { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.hint { margin-top: 3px; font-size: 12px; color: var(--color-text-tertiary); }
.repo-path { margin-top: 14px; padding: 10px 12px; border-radius: 9px; background: var(--color-bg); border: 1px solid var(--color-border-soft); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--color-text-secondary); word-break: break-all; }
.repo-path.empty { color: var(--color-text-tertiary); font-family: inherit; }
textarea { width: 100%; box-sizing: border-box; margin-top: 12px; resize: vertical; border: 1px solid var(--color-border-soft); border-radius: 10px; background: var(--color-bg); color: var(--color-text-primary); padding: 14px; font: inherit; font-size: 14px; line-height: 1.6; outline: none; }
textarea:focus { border-color: var(--color-signal); }
textarea:disabled { opacity: .75; }
.actions { margin-top: 14px; }
.readiness { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--color-text-tertiary); }
.dot, .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-text-tertiary); opacity: .5; }
.dot.ok, .status-dot.awaiting-approval, .status-dot.executing { background: var(--color-success); opacity: 1; }
.status-dot.planning, .status-dot.approving { background: var(--color-warning); opacity: 1; }
.primary, .secondary { border-radius: 9px; font: inherit; cursor: pointer; }
.primary { border: 0; padding: 9px 20px; background: var(--color-signal); color: white; font-weight: 600; }
.primary:disabled, .secondary:disabled { opacity: .35; cursor: default; }
.secondary { border: 1px solid var(--color-border-soft); padding: 8px 12px; background: transparent; color: var(--color-text-secondary); }
.error-box { margin-top: 12px; padding: 10px 12px; border-radius: 9px; background: rgba(122,80,73,.08); color: var(--color-error); font-size: 12px; }
.task-state { margin-top: 16px; border-top: 1px solid var(--color-border-soft); padding-top: 16px; }
.status-line { display: flex; align-items: center; gap: 9px; margin-top: 16px; color: var(--color-text-primary); font-size: 13px; }
.meta-grid { margin: 14px 0; display: grid; gap: 7px; }
.meta-grid div { display: grid; grid-template-columns: 88px 1fr; gap: 10px; font-size: 12px; }
.meta-grid span { color: var(--color-text-tertiary); }
.meta-grid strong { color: var(--color-text-secondary); font-weight: 500; word-break: break-all; }
.plan-card { margin-top: 16px; padding: 14px; border: 1px solid var(--color-border-soft); border-radius: 10px; background: var(--color-bg); }
.plan-card ol { margin: 10px 0 14px 20px; padding: 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.next-note { margin-top: 14px; padding: 10px 12px; border-radius: 9px; background: var(--color-bg); color: var(--color-text-tertiary); font-size: 12px; line-height: 1.6; }
</style>
