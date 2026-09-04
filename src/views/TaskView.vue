<script setup lang="ts">
import { computed, ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'

const repoPath = ref(localStorage.getItem('anvil.vs001.repo') || '')
const taskText = ref('')
const state = ref<'idle' | 'ready' | 'created' | 'error'>(repoPath.value ? 'ready' : 'idle')
const error = ref('')
const createdAt = ref<number | null>(null)

const canRun = computed(() => Boolean(repoPath.value && taskText.value.trim()))

async function chooseRepository() {
  error.value = ''
  try {
    const selected = await open({ directory: true, multiple: false, title: '选择要处理的代码仓库' })
    if (typeof selected === 'string' && selected) {
      repoPath.value = selected
      localStorage.setItem('anvil.vs001.repo', selected)
      // Compatibility bridge for current Dock adapter until VS-001 worker contract replaces it.
      localStorage.setItem('anvil-dock-repo', selected)
      state.value = 'ready'
    }
  } catch (e) {
    state.value = 'error'
    error.value = `无法选择仓库：${String(e)}`
  }
}

function createTask() {
  error.value = ''
  if (!repoPath.value) {
    state.value = 'error'
    error.value = '请先选择仓库。'
    return
  }
  if (!taskText.value.trim()) {
    state.value = 'error'
    error.value = '请描述你希望发生的变化。'
    return
  }

  // VS-001 Phase B: create a visible product task state first.
  // Dock/CodingWorker execution is connected only after clean-boot + product-entry verification.
  createdAt.value = Date.now()
  state.value = 'created'
}

function resetTask() {
  taskText.value = ''
  createdAt.value = null
  state.value = repoPath.value ? 'ready' : 'idle'
  error.value = ''
}
</script>

<template>
  <div class="task-view">
    <div class="hero">
      <div class="eyebrow">ANVIL · VS-001</div>
      <h1>你想让这个仓库发生什么变化？</h1>
      <p>先选择仓库，再用一句自然语言描述任务。这里不需要斜杠命令，也不要求本地模型或 DSH 先启动。</p>
    </div>

    <section class="workspace-card">
      <div class="field-head">
        <div>
          <div class="label">仓库</div>
          <div class="hint">选择一个本机代码仓库</div>
        </div>
        <button class="secondary" @click="chooseRepository">{{ repoPath ? '更换仓库' : '选择仓库' }}</button>
      </div>
      <div class="repo-path" :class="{ empty: !repoPath }">{{ repoPath || '尚未选择' }}</div>
    </section>

    <section class="workspace-card">
      <div class="label">任务</div>
      <textarea
        v-model="taskText"
        :disabled="state === 'created'"
        placeholder="例如：修复登录后偶发回到登录页的问题，并确保现有测试不回退。"
        rows="7"
      />

      <div v-if="error" class="error-box">{{ error }}</div>

      <div v-if="state !== 'created'" class="actions">
        <div class="readiness">
          <span :class="['dot', repoPath ? 'ok' : '']"></span>
          {{ repoPath ? '仓库已就绪' : '等待选择仓库' }}
        </div>
        <button class="primary" :disabled="!canRun" @click="createTask">Run</button>
      </div>

      <div v-else class="task-created">
        <div class="status-row">
          <span class="status-dot"></span>
          <div>
            <strong>任务已创建</strong>
            <p>下一阶段会把这个 Task 通过冻结的 CodingWorker 边界接到 Dock。当前不会假装已经开始执行。</p>
          </div>
        </div>
        <div class="task-summary">
          <div><span>Repository</span><strong>{{ repoPath }}</strong></div>
          <div><span>Task</span><strong>{{ taskText }}</strong></div>
          <div v-if="createdAt"><span>Created</span><strong>{{ new Date(createdAt).toLocaleString() }}</strong></div>
        </div>
        <button class="secondary" @click="resetTask">新建任务</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.task-view { width: min(860px, calc(100% - 48px)); margin: 0 auto; padding: 56px 0 80px; }
.hero { margin-bottom: 28px; }
.eyebrow { font-size: 11px; letter-spacing: .12em; color: var(--color-text-tertiary); margin-bottom: 10px; }
h1 { margin: 0 0 10px; font-size: 28px; line-height: 1.25; color: var(--color-text-primary); font-weight: 650; }
.hero p { margin: 0; max-width: 680px; font-size: 14px; line-height: 1.7; color: var(--color-text-secondary); }
.workspace-card { border: 1px solid var(--color-border-soft); background: var(--color-bg-secondary); border-radius: 14px; padding: 20px; margin-top: 14px; }
.field-head, .actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.label { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.hint { margin-top: 3px; font-size: 12px; color: var(--color-text-tertiary); }
.repo-path { margin-top: 14px; padding: 10px 12px; border-radius: 9px; background: var(--color-bg); border: 1px solid var(--color-border-soft); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--color-text-secondary); word-break: break-all; }
.repo-path.empty { color: var(--color-text-tertiary); font-family: inherit; }
textarea { width: 100%; box-sizing: border-box; margin-top: 12px; resize: vertical; border: 1px solid var(--color-border-soft); border-radius: 10px; background: var(--color-bg); color: var(--color-text-primary); padding: 14px; font: inherit; font-size: 14px; line-height: 1.6; outline: none; }
textarea:focus { border-color: var(--color-signal); }
textarea:disabled { opacity: .75; }
.actions { margin-top: 14px; }
.readiness { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--color-text-tertiary); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-text-tertiary); opacity: .5; }
.dot.ok, .status-dot { background: var(--color-success); opacity: 1; }
.primary, .secondary { border-radius: 9px; font: inherit; cursor: pointer; }
.primary { border: 0; padding: 9px 20px; background: var(--color-signal); color: white; font-weight: 600; }
.primary:disabled { opacity: .35; cursor: default; }
.secondary { border: 1px solid var(--color-border-soft); padding: 8px 12px; background: transparent; color: var(--color-text-secondary); }
.error-box { margin-top: 12px; padding: 10px 12px; border-radius: 9px; background: rgba(122,80,73,.08); color: var(--color-error); font-size: 12px; }
.task-created { margin-top: 16px; border-top: 1px solid var(--color-border-soft); padding-top: 16px; }
.status-row { display: flex; gap: 10px; align-items: flex-start; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: 0 0 auto; }
.status-row strong { font-size: 13px; color: var(--color-text-primary); }
.status-row p { margin: 4px 0 0; font-size: 12px; line-height: 1.6; color: var(--color-text-tertiary); }
.task-summary { margin: 14px 0; display: grid; gap: 8px; }
.task-summary div { display: grid; grid-template-columns: 88px 1fr; gap: 10px; font-size: 12px; }
.task-summary span { color: var(--color-text-tertiary); }
.task-summary strong { color: var(--color-text-secondary); font-weight: 500; word-break: break-word; }
</style>
