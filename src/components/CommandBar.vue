<script setup lang="ts">
import { ref, computed } from 'vue'
import { parse, suggest } from '@/adapters/parse'
import { listCommands } from '@/adapters/registry'
import type { Parsed } from '@/adapters/parse'

const emit = defineEmits<{ submit: [parsed: Parsed] }>()

const input = ref('')
const suggestions = ref<string[]>([])
const showHelp = ref(false)

const commands = computed(() => {
  const adapterCmds = listCommands()
  const builtins = [
    { command: '/switch', description: '切换聊天适配器。用法: /switch <id>', adapterName: '—' },
    { command: '/help', description: '显示全部命令', adapterName: '—' },
  ]
  return [...builtins, ...adapterCmds]
})

function onInput() {
  const val = input.value
  if (val.startsWith('/')) {
    suggestions.value = suggest(val)
    showHelp.value = false
  } else {
    suggestions.value = []
    showHelp.value = false
  }
}

function selectSuggestion(cmd: string) {
  input.value = cmd + ' '
  suggestions.value = []
}

function onSubmit() {
  const text = input.value.trim()
  if (!text) return
  if (text === '/help') {
    showHelp.value = !showHelp.value
    input.value = ''
    return
  }
  const p = parse(text)
  emit('submit', p)
  input.value = ''
  suggestions.value = []
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
  if (e.key === 'Escape') {
    suggestions.value = []
    showHelp.value = false
  }
}
</script>

<template>
  <div class="command-bar">
    <div v-if="suggestions.length" class="suggestions">
      <div v-for="s in suggestions" :key="s" class="suggestion" @mousedown.prevent="selectSuggestion(s)">{{ s }}</div>
    </div>

    <div v-if="showHelp" class="help-panel">
      <div class="help-title">可用命令</div>
      <div v-for="c in commands" :key="c.command" class="help-row">
        <span class="help-cmd">{{ c.command }}</span>
        <span class="help-desc">{{ c.description }}</span>
        <span class="help-adapter">{{ c.adapterName }}</span>
      </div>
      <div class="help-footer">直接输入文字开始聊天。/switch <适配器> 切换聊天引擎。可用适配器：输入 /switch 查看全部。</div>
    </div>

    <div class="input-row">
      <textarea
        v-model="input"
        @input="onInput"
        @keydown="onKeydown"
        placeholder="输入消息，Enter 发送。斜杠调工具，/help 查看全部。"
        rows="2"
      ></textarea>
      <button class="send-btn" @click="onSubmit" :disabled="!input.trim()">发送</button>
    </div>
  </div>
</template>

<style scoped>
.command-bar { border-top: 1px solid var(--line); background: var(--raised); position: relative; }
.suggestions {
  position: absolute; bottom: 100%; left: 0; right: 0;
  background: var(--raised); border: 1px solid var(--line); border-bottom: none;
  border-radius: 9px 9px 0 0; max-height: 160px; overflow-y: auto;
}
.suggestion { padding: 8px 16px; font-size: 13px; font-family: var(--mono); cursor: pointer; color: var(--ink); }
.suggestion:hover { background: var(--signalSoft); }
.help-panel {
  position: absolute; bottom: 100%; left: 0; right: 0;
  background: var(--raised); border: 1px solid var(--line); border-bottom: none;
  border-radius: 9px 9px 0 0; max-height: 300px; overflow-y: auto; padding: 12px 16px;
}
.help-title { font-size: 12px; font-weight: 600; color: var(--ink2); margin-bottom: 8px; }
.help-row { display: flex; gap: 8px; padding: 4px 0; font-size: 12px; align-items: baseline; }
.help-cmd { font-family: var(--mono); color: var(--signal); min-width: 80px; }
.help-desc { color: var(--ink2); flex: 1; }
.help-adapter { color: var(--ink3); font-size: 11px; }
.help-footer { font-size: 11px; color: var(--ink3); margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--line); }
.input-row { display: flex; gap: 8px; padding: 12px 20px 16px; }
textarea {
  flex: 1; resize: none; border: 1px solid var(--line); border-radius: 9px;
  padding: 10px 12px; font-size: 14px; font-family: inherit;
  background: var(--surface); color: var(--ink); outline: none;
}
textarea:focus { border-color: var(--signal); }
.send-btn {
  border: none; background: var(--signal); color: var(--canvas);
  border-radius: 9px; padding: 10px 18px; font-size: 14px; font-weight: 500;
  cursor: pointer; align-self: flex-end;
}
.send-btn:disabled { opacity: 0.4; cursor: default; }
</style>