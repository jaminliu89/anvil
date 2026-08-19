<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { parse } from '@/adapters/parse'
import { listCommands } from '@/adapters/registry'
import { guessIntent, listAvailableAdapters } from '@/adapters/intent'
import type { Parsed } from '@/adapters/parse'
import type { IntentGuess } from '@/adapters/intent'

const emit = defineEmits<{ submit: [parsed: Parsed] }>()

const input = ref('')
const showPalette = ref(false)
const showIntentPicker = ref(false)
const selectedPaletteIdx = ref(0)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 意图猜测
const intent = computed<IntentGuess | null>(() => {
  const val = input.value.trim()
  if (!val) return null
  if (val.startsWith('/')) return null
  return guessIntent(val)
})

// 命令面板数据
interface PaletteItem {
  command: string
  description: string
  adapterName: string
  category: string
}

const paletteItems = computed<PaletteItem[]>(() => {
  const adapterCmds = listCommands()
  const builtins = [
    { command: '/switch', description: '切换聊天适配器', adapterName: '系统', category: '系统' },
    { command: '/help', description: '显示全部命令', adapterName: '系统', category: '系统' },
  ]

  const catMap: Record<string, string> = {
    'DSH Agent': 'Agent 框架',
    'Dock': '编码',
    'Reasonix': '编码',
    'Pi': '编码',
    'Codex': '编码',
    'Ling': '聊天',
    'Unsloth': '训练',
  }

  const items: PaletteItem[] = [
    ...builtins.map(b => ({ ...b, category: b.category })),
    ...adapterCmds.map(c => ({
      command: c.command,
      description: c.description,
      adapterName: c.adapterName,
      category: catMap[c.adapterName] || '其他',
    })),
  ]

  // 如果有输入过滤
  if (input.value.startsWith('/')) {
    const partial = input.value.slice(1).toLowerCase()
    return items.filter(i =>
      i.command.toLowerCase().includes(partial) ||
      i.description.toLowerCase().includes(partial)
    )
  }
  return items
})

// 按分类分组
const groupedPalette = computed(() => {
  const groups: Record<string, PaletteItem[]> = {}
  for (const item of paletteItems.value) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  }
  return groups
})

const flatPaletteItems = computed(() => {
  const flat: PaletteItem[] = []
  for (const items of Object.values(groupedPalette.value)) {
    flat.push(...items)
  }
  return flat
})

function onInput() {
  const val = input.value
  if (val.startsWith('/')) {
    showPalette.value = true
    selectedPaletteIdx.value = 0
    showIntentPicker.value = false
  } else {
    showPalette.value = false
  }
}

function selectPaletteItem(item: PaletteItem) {
  input.value = item.command + ' '
  showPalette.value = false
  nextTick(() => textareaRef.value?.focus())
}

function pickAdapter(adapterId: string) {
  // 告诉父组件切换 adapter 后发送
  const text = input.value.trim()
  showIntentPicker.value = false
  emit('submit', {
    type: 'builtin' as const,
    command: 'switch_and_chat',
    args: `${adapterId}:::${text}`,
  })
  input.value = ''
}

function onSubmit() {
  const text = input.value.trim()
  if (!text) return

  if (showPalette.value && flatPaletteItems.value.length > 0) {
    selectPaletteItem(flatPaletteItems.value[selectedPaletteIdx.value])
    return
  }

  // 如果有意图猜测且置信度够高，用猜测的 adapter
  // 但这里我们先保持原样：普通文字 = chat，走当前 adapter
  // 意图猜测只是提示，用户确认用
  const p = parse(text)
  emit('submit', p)
  input.value = ''
  showPalette.value = false
}

function onKeydown(e: KeyboardEvent) {
  // 命令面板导航
  if (showPalette.value && flatPaletteItems.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedPaletteIdx.value = (selectedPaletteIdx.value + 1) % flatPaletteItems.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedPaletteIdx.value = (selectedPaletteIdx.value - 1 + flatPaletteItems.value.length) % flatPaletteItems.value.length
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      selectPaletteItem(flatPaletteItems.value[selectedPaletteIdx.value])
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
  if (e.key === 'Escape') {
    showPalette.value = false
    showIntentPicker.value = false
  }
}

// 可用 adapter 列表
const availableAdapters = computed(() => listAvailableAdapters())

// 按分类分组（模板用）
const groupedAdapters = computed(() => {
  const groups: Record<string, { id: string; name: string; description: string }[]> = {}
  for (const a of availableAdapters.value) {
    if (!groups[a.category]) groups[a.category] = []
    groups[a.category].push({ id: a.id, name: a.name, description: a.description })
  }
  return groups
})
</script>

<template>
  <div class="command-bar">
    <!-- 意图猜测条（输入文字时显示在输入框上方） -->
    <div v-if="intent && !showPalette" class="intent-bar">
      <div class="intent-left">
        <span class="intent-label">将使用</span>
        <button class="intent-adapter" @click="showIntentPicker = !showIntentPicker">
          {{ intent.adapterName }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <span class="intent-reason">· {{ intent.reason }}</span>
      </div>
      <span class="intent-hint">Enter 发送 · 点击切换</span>

      <!-- 意图选择下拉 -->
      <div v-if="showIntentPicker" class="intent-picker">
        <div v-for="(items, cat) in groupedAdapters" :key="cat" class="picker-group">
          <div class="picker-group-title">{{ cat }}</div>
          <div v-for="a in items" :key="a.id"
               class="picker-item"
               :class="{ active: a.id === intent?.adapterId }"
               @click="pickAdapter(a.id)">
            <span class="picker-name">{{ a.name }}</span>
            <span class="picker-desc">{{ a.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 命令面板（输入 / 时展开） -->
    <Transition name="palette">
      <div v-if="showPalette && paletteItems.length > 0" class="palette">
        <div v-for="(items, category) in groupedPalette" :key="category" class="palette-group">
          <div class="palette-group-title">{{ category }}</div>
          <div v-for="item in items"
               :key="item.command"
               class="palette-item"
               :class="{ active: flatPaletteItems[selectedPaletteIdx]?.command === item.command }"
               @mousedown.prevent="selectPaletteItem(item)">
            <span class="palette-cmd">{{ item.command }}</span>
            <span class="palette-desc">{{ item.description }}</span>
            <span class="palette-adapter">{{ item.adapterName }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <div class="input-row">
      <textarea
        ref="textareaRef"
        v-model="input"
        @input="onInput"
        @keydown="onKeydown"
        placeholder="说点什么，我来搞定。斜杠调工具。"
        rows="2"
      ></textarea>
      <button class="send-btn" @click="onSubmit" :disabled="!input.trim()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.command-bar {
  border-top: 1px solid var(--line-subtle);
  background: var(--canvas);
  position: relative;
}

/* ── 意图猜测条 ── */
.intent-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  font-size: 11px;
  color: var(--ink3);
  background: var(--surface);
  border-bottom: 1px solid var(--line-subtle);
  position: relative;
}
.intent-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.intent-label {
  color: var(--ink4);
}
.intent-adapter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--canvas);
  color: var(--ink);
  font-weight: 500;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition: all 120ms ease;
}
.intent-adapter:hover {
  border-color: var(--ink3);
}
.intent-reason {
  color: var(--ink4);
}
.intent-hint {
  color: var(--ink4);
  font-family: var(--mono);
}

/* 意图选择下拉 */
.intent-picker {
  position: absolute;
  bottom: 100%;
  left: 12px;
  margin-bottom: 4px;
  min-width: 280px;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  z-index: 10;
  overflow: hidden;
}
.picker-group {
  padding: 4px 0;
}
.picker-group + .picker-group {
  border-top: 1px solid var(--line-subtle);
}
.picker-group-title {
  font-size: 10px;
  color: var(--ink4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 6px 12px 4px;
  font-weight: 500;
}
.picker-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 120ms ease;
}
.picker-item:hover,
.picker-item.active {
  background: var(--muted);
}
.picker-name {
  font-size: 12px;
  color: var(--ink);
  font-weight: 500;
}
.picker-desc {
  font-size: 11px;
  color: var(--ink3);
}

/* ── 命令面板 ── */
.palette {
  position: absolute;
  bottom: 100%;
  left: 12px;
  right: 12px;
  margin-bottom: 4px;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  z-index: 10;
  max-height: 320px;
  overflow-y: auto;
}
.palette-group {
  padding: 4px 0;
}
.palette-group + .palette-group {
  border-top: 1px solid var(--line-subtle);
}
.palette-group-title {
  font-size: 10px;
  color: var(--ink4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 6px 12px 4px;
  font-weight: 500;
}
.palette-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 120ms ease;
}
.palette-item:hover,
.palette-item.active {
  background: var(--muted);
}
.palette-cmd {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--signal);
  min-width: 80px;
  flex-shrink: 0;
}
.palette-desc {
  flex: 1;
  font-size: 12px;
  color: var(--ink2);
}
.palette-adapter {
  font-size: 11px;
  color: var(--ink4);
  flex-shrink: 0;
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
.palette-enter-active,
.palette-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

/* ── 输入区 ── */
.input-row {
  display: flex;
  gap: 10px;
  padding: 10px 12px 12px;
  align-items: flex-end;
}
textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  background: var(--canvas);
  color: var(--ink);
  outline: none;
  line-height: 1.5;
  transition: border-color 120ms ease;
}
textarea:focus {
  border-color: var(--ink3);
}
.send-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--signal);
  color: var(--canvas);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 120ms ease;
  align-self: flex-end;
  padding: 0;
}
.send-btn:hover:not(:disabled) {
  opacity: 0.9;
}
.send-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
</style>
