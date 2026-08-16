<script setup lang="ts">
// 训练工坊页 — Parchment 暖纸设计系统 + 零术语 LoRA 微调

import { ref, onMounted, onUnmounted } from 'vue'
import {
  startTrain, trainStatus, stopTrain, listCheckpoints,
  type TrainConfig, type TrainStatus, type Checkpoint,
  sidecarAlive
} from '../services/dsh'

// 服务状态
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

// 可用基座模型列表
const modelOptions = [
  { label: 'Ling-3.0-tiny (1.3B 轻量核心)', value: 'inclusionAI/Ling-3.0-tiny' },
  { label: 'Llama 3.2 1B (高速模型)', value: 'unsloth/Llama-3.2-1B-Instruct' },
  { label: 'Llama 3.2 3B (通用模型)', value: 'unsloth/Llama-3.2-3B-Instruct' },
  { label: 'Qwen 2.5 1.5B (全能模型)', value: 'unsloth/Qwen2.5-1.5B-Instruct' },
  { label: 'Gemma 2 2B (精简模型)', value: 'unsloth/gemma-2b-it' },
]

const customModel = ref('')
function activeModel(): string {
  return model.value === '__custom__' ? customModel.value : model.value
}

// 训练运行状态
const running = ref(false)
const step = ref(0)
const loss = ref(0)
const elapsed = ref(0)
const logs = ref<string[]>([])
const statusMsg = ref('')

// 检查点
const checkpoints = ref<Checkpoint[]>([])
const cpLoading = ref(false)

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

  statusMsg.value = '准备开启训练...'
  try {
    const res = await startTrain(cfg)
    if (res.ok) {
      running.value = true
      startPolling()
    }
  } catch (e: any) {
    statusMsg.value = `启动训练遇到问题: ${e.message}`
  }
}

async function doStop() {
  try {
    await stopTrain()
    running.value = false
    statusMsg.value = '训练已主动停止'
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
        statusMsg.value = '微调训练完成！'
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
      // 忽略轮询间隔波动
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

const fileInput = ref<HTMLInputElement | null>(null)
function pickDataset() {
  fileInput.value?.click()
}
function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    localDataset.value = input.files[0].name
    statusMsg.value = `已选中数据文件: ${localDataset.value}`
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}分${s.toString().padStart(2, '0')}秒`
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
      <h1 class="page-title">训练工坊</h1>
      <p class="page-sub">在本地微调 AI 大脑，无需敲一行终端命令</p>
    </div>

    <!-- 服务状态 -->
    <div class="card bridge-card">
      <div class="bridge-row">
        <div>
          <span class="label">守卫服务状态</span>
          <div class="sub-text">提供训练与后台管理通道</div>
        </div>
        <span v-if="bridging" class="badge badge-pending">检测中…</span>
        <span v-else-if="bridgeAlive" class="badge badge-online">在线</span>
        <span v-else class="badge badge-offline">离线</span>
      </div>
    </div>

    <!-- 配置卡片 -->
    <div class="card config-card" v-if="bridgeAlive">
      <div class="form-group">
        <label class="form-label">基础模型</label>
        <select v-model="model" class="form-select">
          <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          <option value="__custom__">自定义 HuggingFace 模型 ID...</option>
        </select>
        <input v-if="model === '__custom__'" v-model="customModel" class="form-input" placeholder="输入模型名称（如 unsloth/Llama-3.2-1B）" style="margin-top: 8px;" />
      </div>

      <div class="form-group">
        <label class="form-label">数据集</label>
        <div class="dataset-row">
          <input v-model="dataset" class="form-input" placeholder="线上数据集名称" />
          <span class="or-divider">或</span>
          <button class="btn btn-secondary" @click="pickDataset">选择本地数据文件</button>
        </div>
        <input v-model="localDataset" class="form-input" placeholder="本地数据集路径 (.jsonl / .csv)" style="margin-top: 8px;" />
        <input ref="fileInput" type="file" accept=".jsonl,.json,.csv,.txt" style="display:none" @change="onFileSelected" />
      </div>

      <button class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        <span>{{ showAdvanced ? '收起高级参数' : '展开高级微调参数' }}</span>
      </button>

      <div v-if="showAdvanced" class="advanced-section">
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">训练轮数 (Epochs)</label>
            <input v-model.number="epochs" type="number" min="1" max="100" class="form-input" />
          </div>
          <div class="form-group half">
            <label class="form-label">学习率 (Learning Rate)</label>
            <input v-model="learningRate" class="form-input" placeholder="2e-4" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">LoRA 秩 (Rank)</label>
            <input v-model.number="loraR" type="number" min="1" max="256" class="form-input" />
          </div>
          <div class="form-group half">
            <label class="form-label">批处理大小 (Batch Size)</label>
            <input v-model.number="batchSize" type="number" min="1" max="64" class="form-input" />
          </div>
        </div>
      </div>

      <div class="action-row">
        <button v-if="!running" class="btn btn-primary btn-start" @click="doStart" :disabled="!activeModel() || (!dataset && !localDataset)">
          开启训练
        </button>
        <button v-else class="btn btn-danger btn-stop" @click="doStop">
          停止训练
        </button>
      </div>
      <p v-if="statusMsg" class="status-msg">{{ statusMsg }}</p>
    </div>

    <!-- 训练实时进度 -->
    <div v-if="running" class="card progress-card">
      <div class="card-title">训练进度监控</div>
      <div class="progress-stats">
        <div class="stat">
          <span class="stat-value">{{ step }}</span>
          <span class="stat-label">已执行步数</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ loss.toFixed(4) }}</span>
          <span class="stat-label">当前 Loss 损失</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ formatTime(elapsed) }}</span>
          <span class="stat-label">累计耗时</span>
        </div>
      </div>
      <div class="log-viewer">
        <div v-for="(line, i) in logs" :key="i" class="log-line">{{ line }}</div>
      </div>
    </div>

    <!-- 已保存的检查点 -->
    <div v-if="bridgeAlive" class="section-head">
      <h2 class="section-title">已产出的训练检查点</h2>
      <button v-if="!cpLoading" class="btn btn-ghost" @click="fetchCheckpoints()">刷新</button>
    </div>

    <div v-if="cpLoading" class="loading-hint">正在读取检查点…</div>

    <div v-if="!cpLoading && checkpoints.length === 0 && bridgeAlive" class="card empty-card">
      <p class="empty-text">暂无微调产物。配置好数据集后点击“开启训练”即可生成。</p>
    </div>

    <div v-if="checkpoints.length > 0" class="cp-list">
      <div v-for="(cp, i) in checkpoints" :key="i" class="cp-item">
        <div class="cp-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          </svg>
          <div class="cp-info">
            <span class="cp-name">{{ cp.name ?? cp.model ?? 'checkpoint-' + (i + 1) }}</span>
            <span class="cp-meta">{{ cp.path ?? '存放在本地工坊目录' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: 32px 40px;
  max-width: 680px;
}
.page-head { margin-bottom: 24px; }
.page-title { font-size: var(--font-xl); font-weight: var(--font-bold); color: var(--ink); margin-bottom: 4px; }
.page-sub { font-size: var(--font-sm); color: var(--ink3); }

.card {
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
}

.bridge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label { font-size: var(--font-sm); font-weight: var(--font-semibold); color: var(--ink); }
.sub-text { font-size: var(--font-xs); color: var(--ink3); margin-top: 2px; }

.badge {
  font-size: var(--font-2xs);
  font-weight: var(--font-medium);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
}
.badge-online { background: rgba(80, 99, 79, 0.12); color: var(--success); }
.badge-offline { background: var(--surface); color: var(--ink4); }
.badge-pending { background: rgba(128, 101, 68, 0.12); color: var(--warning); }

.form-group { margin-bottom: 16px; }
.form-group.half { flex: 1; min-width: 0; }
.form-label {
  display: block;
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  color: var(--ink2);
  margin-bottom: 6px;
}
.form-input, .form-select {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  font-size: var(--font-sm);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  color: var(--ink);
  outline: none;
  box-sizing: border-box;
}
.form-input:focus, .form-select:focus {
  border-color: var(--signal);
}

.dataset-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dataset-row .form-input { flex: 1; }
.or-divider { font-size: var(--font-xs); color: var(--ink4); }

.form-row {
  display: flex;
  gap: 12px;
}

.advanced-toggle {
  font-size: var(--font-xs);
  color: var(--signal);
  font-weight: var(--font-medium);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-bottom: 14px;
}
.advanced-section {
  padding: 14px;
  background: var(--surface);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
  border: 1px solid var(--line);
}

.btn {
  padding: 8px 16px;
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-primary {
  background: var(--signal);
  color: var(--raised);
  border: 1px solid var(--signal);
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-danger {
  background: var(--error);
  color: white;
  border: none;
}
.btn-secondary {
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  white-space: nowrap;
}
.btn-ghost {
  background: none;
  color: var(--signal);
  border: none;
  font-size: var(--font-xs);
}

.btn-start, .btn-stop { width: 100%; height: 42px; font-size: var(--font-sm); }
.status-msg {
  font-size: var(--font-xs);
  color: var(--ink3);
  margin-top: 10px;
  text-align: center;
}

.progress-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 14px;
}
.stat {
  display: flex;
  flex-direction: column;
}
.stat-value {
  font-size: var(--font-xl);
  font-weight: var(--font-bold);
  color: var(--ink);
}
.stat-label {
  font-size: var(--font-2xs);
  color: var(--ink3);
}

.log-viewer {
  max-height: 180px;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 10px;
  font-family: monospace;
  font-size: 11px;
}
.log-line { color: var(--ink2); }

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title { font-size: var(--font-md); font-weight: var(--font-semibold); color: var(--ink); }

.empty-text {
  font-size: var(--font-xs);
  color: var(--ink3);
  text-align: center;
}

.cp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
.cp-left { display: flex; align-items: center; gap: 12px; }
.cp-left svg { color: var(--signal); }
.cp-info { display: flex; flex-direction: column; }
.cp-name { font-size: var(--font-sm); font-weight: var(--font-semibold); color: var(--ink); }
.cp-meta { font-size: var(--font-2xs); color: var(--ink3); }
</style>