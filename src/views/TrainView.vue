<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  startTrain, trainStatus, stopTrain, listCheckpoints,
  type TrainConfig, type TrainStatus, type Checkpoint
} from '../services/dsh'
import { sidecarAlive } from '../services/dsh'

// 支撑状态
const bridgeAlive = ref(false)
const bridging = ref(true)

// 训练配置
const model = ref('inclusionAI/Ling-3.0-tiny')
const dataset = ref('')
const localDataset = ref('')
const epochs = ref(1)
const learningRate = ref('2e-4')
const loraR = ref(16)
const batchSize = ref(2)
const maxSeqLen = ref(4096)
const showAdvanced = ref(false)

// 可用模型列表
const modelOptions = [
  { label: 'Ling-3.0-tiny (1.3B MoE)', value: 'inclusionAI/Ling-3.0-tiny' },
  { label: 'Llama 3.2 1B', value: 'unsloth/Llama-3.2-1B-Instruct' },
  { label: 'Llama 3.2 3B', value: 'unsloth/Llama-3.2-3B-Instruct' },
  { label: 'Qwen 2.5 1.5B', value: 'unsloth/Qwen2.5-1.5B-Instruct' },
  { label: 'Gemma 2 2B', value: 'unsloth/gemma-2b-it' },
]

const customModel = ref('')
function activeModel(): string {
  return model.value === '__custom__' ? customModel.value : model.value
}

// 训练运行状态
const running = ref(false)
const training = ref(false)  // 是否正在轮询
const step = ref(0)
const loss = ref(0)
const elapsed = ref(0)
const logs = ref<string[]>([])
const statusMsg = ref('')

// 检查点
const checkpoints = ref<Checkpoint[]>([])
const cpLoading = ref(false)

// 轮询定时器
let pollTimer: ReturnType<typeof setInterval> | null = null

async function checkBridge() {
  bridgeAlive.value = await sidecarAlive()
  bridging.value = false
}

async function doStart() {
  if (running.value) return
  const cfg: TrainConfig = {
    model: activeModel(),
    epochs: epochs.value,
    learning_rate: parseFloat(learningRate.value),
    lora_r: loraR.value,
    batch_size: batchSize.value,
    max_seq_length: maxSeqLen.value,
  }
  if (dataset.value) cfg.dataset = dataset.value
  if (localDataset.value) cfg.local_dataset = localDataset.value

  statusMsg.value = '启动训练...'
  try {
    const res = await startTrain(cfg)
    if (res.ok) {
      running.value = true
      training.value = true
      startPolling()
    }
  } catch (e: any) {
    statusMsg.value = `启动失败: ${e.message}`
  }
}

async function doStop() {
  try {
    await stopTrain()
    running.value = false
    training.value = false
    statusMsg.value = '训练已停止'
    stopPolling()
  } catch (e: any) {
    statusMsg.value = `停止失败: ${e.message}`
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const s: TrainStatus = await trainStatus()
      if (!s.running) {
        running.value = false
        statusMsg.value = '训练完成'
        stopPolling()
        fetchCheckpoints()
        return
      }
      step.value = s.step
      loss.value = s.loss
      elapsed.value = s.elapsed_s
      if (s.log && s.log.length > logs.value.length) {
        logs.value = [...s.log]
      }
    } catch {
      // 轮询出错，继续
    }
  }, 2000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function fetchCheckpoints() {
  cpLoading.value = true
  try {
    const r = await listCheckpoints()
    checkpoints.value = r.checkpoints ?? []
  } catch {
    checkpoints.value = []
  } finally {
    cpLoading.value = false
  }
}

// 文件选择
const fileInput = ref<HTMLInputElement | null>(null)
function pickDataset() {
  fileInput.value?.click()
}
function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    localDataset.value = input.files[0].name
    statusMsg.value = `已选数据集: ${localDataset.value}（需要完整路径）`
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}m${s.toString().padStart(2, '0')}s`
}

onMounted(async () => {
  await checkBridge()
  if (bridgeAlive.value) {
    await fetchCheckpoints()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">训练</h1>
      <p class="page-sub">在本地微调模型，无需打开终端</p>
    </div>

    <!-- 桥梁状态 -->
    <div class="card bridge-card">
      <div class="bridge-row">
        <span class="label">侧车桥梁</span>
        <span v-if="bridging" class="badge badge-pending">检测中</span>
        <span v-else-if="bridgeAlive" class="badge badge-online">在线</span>
        <span v-else class="badge badge-offline">离线</span>
      </div>
    </div>

    <!-- 配置表单 -->
    <div class="card config-card" v-if="bridgeAlive">
      <div class="form-group">
        <label class="form-label">基础模型</label>
        <select v-model="model" class="form-select">
          <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          <option value="__custom__">自定义模型...</option>
        </select>
        <input v-if="model === '__custom__'" v-model="customModel" class="form-input" placeholder="HuggingFace 模型 ID" style="margin-top: 6px;" />
      </div>

      <div class="form-group">
        <label class="form-label">数据集</label>
        <div class="dataset-row">
          <input v-model="dataset" class="form-input" placeholder="HuggingFace 数据集名称" />
          <span class="or-divider">或</span>
          <button class="btn btn-secondary btn-file" @click="pickDataset">选择本地文件</button>
        </div>
        <input v-model="localDataset" class="form-input" placeholder="本地数据集路径" style="margin-top: 6px;" />
        <input ref="fileInput" type="file" accept=".jsonl,.json,.csv,.txt" style="display:none" @change="onFileSelected" />
      </div>

      <!-- 展开高级参数 -->
      <button class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        <svg :class="{ rotated: showAdvanced }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        高级参数
      </button>

      <div v-if="showAdvanced" class="advanced-section">
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">迭代轮数</label>
            <input v-model.number="epochs" type="number" min="1" max="100" class="form-input" />
          </div>
          <div class="form-group half">
            <label class="form-label">学习率</label>
            <input v-model="learningRate" class="form-input" placeholder="2e-4" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">LoRA rank</label>
            <input v-model.number="loraR" type="number" min="1" max="256" class="form-input" />
          </div>
          <div class="form-group half">
            <label class="form-label">批大小</label>
            <input v-model.number="batchSize" type="number" min="1" max="64" class="form-input" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">最大序列长度</label>
          <input v-model.number="maxSeqLen" type="number" min="512" max="32768" step="512" class="form-input" />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-row">
        <button v-if="!running" class="btn btn-primary btn-start" @click="doStart" :disabled="!activeModel() || (!dataset && !localDataset)">
          开始训练
        </button>
        <button v-else class="btn btn-danger btn-stop" @click="doStop">
          停止训练
        </button>
      </div>
      <p v-if="statusMsg" class="status-msg">{{ statusMsg }}</p>
    </div>

    <!-- 训练进度 -->
    <div v-if="running" class="card progress-card">
      <h3 class="progress-title">训练进度</h3>
      <div class="progress-stats">
        <div class="stat">
          <span class="stat-value">{{ step }}</span>
          <span class="stat-label">步数</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ loss.toFixed(4) }}</span>
          <span class="stat-label">损失</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ formatTime(elapsed) }}</span>
          <span class="stat-label">耗时</span>
        </div>
      </div>
      <div class="log-viewer">
        <div v-for="(line, i) in logs" :key="i" class="log-line">{{ line }}</div>
      </div>
    </div>

    <!-- 检查点列表 -->
    <div v-if="bridgeAlive" class="section-head">
      <h2 class="section-title">已训练检查点</h2>
      <button v-if="!cpLoading" class="btn btn-ghost btn-sm" @click="fetchCheckpoints()">刷新</button>
    </div>

    <div v-if="cpLoading" class="loading-hint">加载中...</div>

    <div v-if="!cpLoading && checkpoints.length === 0 && bridgeAlive" class="card empty-card">
      <p class="empty-text">暂无检查点。配置参数后开始训练。</p>
    </div>

    <div v-if="checkpoints.length > 0" class="cp-list">
      <div v-for="(cp, i) in checkpoints" :key="i" class="cp-item">
        <div class="cp-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div class="cp-info">
            <span class="cp-name">{{ cp.name ?? cp.model ?? 'checkpoint-' + (i + 1) }}</span>
            <span class="cp-meta">{{ cp.path ?? '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: var(--space-8);
  max-width: 640px;
}
.page-head { margin-bottom: var(--space-6); }
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

/* 卡片通用 */
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

/* 桥梁状态 */
.bridge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label { font-size: var(--font-sm); font-weight: var(--font-medium); }

.badge {
  font-size: var(--font-2xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
}
.badge-online { background: color-mix(in srgb, var(--color-success) 15%, transparent); color: var(--color-success); }
.badge-offline { background: color-mix(in srgb, var(--color-text-tertiary) 15%, transparent); color: var(--color-text-tertiary); }
.badge-pending { background: color-mix(in srgb, var(--color-warning) 15%, transparent); color: var(--color-warning); }

/* 表单 */
.form-group { margin-bottom: var(--space-4); }
.form-group.half { flex: 1; min-width: 0; }
.form-label {
  display: block;
  font-size: var(--font-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-1);
}
.form-input, .form-select {
  width: 100%;
  height: 36px;
  padding: 0 var(--space-3);
  font-size: var(--font-sm);
  font-family: inherit;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  outline: none;
  box-sizing: border-box;
}
.form-input:focus, .form-select:focus {
  border-color: var(--color-signal);
  box-shadow: 0 0 0 2px var(--color-signal-soft);
}
.form-select { cursor: pointer; }

.dataset-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.dataset-row .form-input { flex: 1; }
.or-divider {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  white-space: nowrap;
}
.btn-file { white-space: nowrap; flex-shrink: 0; }

.form-row {
  display: flex;
  gap: var(--space-3);
}

/* 高级参数折叠 */
.advanced-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-xs);
  color: var(--color-signal);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-bottom: var(--space-3);
  font-family: inherit;
}
.advanced-toggle svg {
  transition: transform 0.2s;
}
.advanced-toggle svg.rotated {
  transform: rotate(90deg);
}
.advanced-section {
  padding: var(--space-3);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-3);
}

/* 按钮 */
.btn {
  height: 32px; padding: 0 var(--space-4);
  font-size: var(--font-xs); font-weight: var(--font-medium);
  border-radius: var(--radius-sm); cursor: pointer;
  font-family: inherit;
  transition: all var(--transition-fast);
}
.btn-primary {
  background: var(--color-signal); color: var(--color-bg);
  border: none;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-danger {
  background: var(--color-error); color: white;
  border: none;
}
.btn-danger:hover { opacity: 0.85; }
.btn-secondary {
  background: var(--color-bg-tertiary); color: var(--color-text);
  border: 1px solid var(--color-border-soft);
}
.btn-secondary:hover { border-color: var(--color-border); }
.btn-ghost {
  background: none; color: var(--color-signal);
  border: none; padding: 0;
  font-size: var(--font-xs);
  cursor: pointer;
}
.btn-ghost:hover { text-decoration: underline; }
.btn-sm { height: 26px; padding: 0 var(--space-2); }

.action-row { margin-top: var(--space-2); }
.btn-start, .btn-stop { width: 100%; height: 40px; font-size: var(--font-sm); }
.status-msg {
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-2);
  text-align: center;
}

/* 训练进度 */
.progress-card { border-color: var(--color-signal); }
.progress-title {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-3);
}
.progress-stats {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-value {
  font-size: var(--font-xl);
  font-weight: var(--font-semibold);
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: var(--font-2xs);
  color: var(--color-text-tertiary);
}
.log-viewer {
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: var(--font-2xs);
  line-height: 1.5;
}
.log-line { white-space: pre-wrap; word-break: break-all; color: var(--color-text-secondary); }

/* 节头 */
.section-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--space-3);
}
.section-title {
  font-size: var(--font-sm); font-weight: var(--font-medium);
}

/* 检查点 */
.loading-hint {
  font-size: var(--font-xs); color: var(--color-text-tertiary);
  margin-bottom: var(--space-3);
}
.empty-card .empty-text {
  font-size: var(--font-xs); color: var(--color-text-tertiary);
  text-align: center; margin: var(--space-2) 0;
}

.cp-list {
  display: flex; flex-direction: column; gap: 1px;
  background: var(--color-border-soft);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md); overflow: hidden;
  margin-bottom: var(--space-4);
}
.cp-item {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
}
.cp-left { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.cp-left svg { color: var(--color-text-tertiary); flex-shrink: 0; }
.cp-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.cp-name { font-size: var(--font-sm); font-weight: var(--font-medium); color: var(--color-text); }
.cp-meta { font-size: var(--font-2xs); color: var(--color-text-tertiary); }
</style>