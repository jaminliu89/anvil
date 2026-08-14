<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Assistant } from '@/types/assistant'

const props = defineProps<{
  visible: boolean
  assistant?: Assistant | null
}>()

const emit = defineEmits<{
  close: []
  save: [assistant: Partial<Assistant>]
  delete: [id: string]
}>()

const name = ref('')
const role = ref('')
const description = ref('')
const systemPrompt = ref('')

const isEditing = computed(() => !!props.assistant)
const title = computed(() => (isEditing.value ? '编辑助手' : '新建助手'))

const colorOptions = [
  '#b8a990', // 暖石
  '#8b9e80', // 雾绿
  '#9088b8', // 薰紫
  '#b89090', // 陶土
  '#8aa8b8', // 灰蓝
  '#c4a25a', // 琥珀
  '#a0a0a0', // 石墨
]

const selectedColor = ref(colorOptions[0])

watch(
  () => props.visible,
  (v) => {
    if (v && props.assistant) {
      name.value = props.assistant.name
      role.value = props.assistant.role
      description.value = props.assistant.description
      selectedColor.value = props.assistant.color
      systemPrompt.value = props.assistant.systemPrompt || ''
    } else if (v) {
      name.value = ''
      role.value = ''
      description.value = ''
      selectedColor.value = colorOptions[0]
      systemPrompt.value = ''
    }
  },
)

const initial = computed(() => (name.value ? name.value.charAt(0) : '?'))

function save() {
  if (!name.value.trim()) return
  emit('save', {
    name: name.value.trim(),
    role: role.value.trim(),
    description: description.value.trim(),
    color: selectedColor.value,
    systemPrompt: systemPrompt.value.trim(),
    avatar: '',
    dshProfile: 'web',
    mode: 'standard',
    defaultPlugins: [],
  })
}

function handleDelete() {
  if (props.assistant && confirm(`确定要删除「${props.assistant.name}」吗？`)) {
    emit('delete', props.assistant.id)
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
      <div class="modal">
        <header class="modal-header">
          <h2>{{ title }}</h2>
          <button class="close-btn" @click="emit('close')"></button>
        </header>

        <div class="modal-body">
          <!-- 头像预览 + 主题色 -->
          <div class="avatar-preview-row">
            <div
              class="avatar-preview"
              :style="{ backgroundColor: selectedColor + '20', color: selectedColor }"
            >
              {{ initial }}
            </div>
            <div class="color-picker">
              <button
                v-for="color in colorOptions"
                :key="color"
                class="color-swatch"
                :class="{ active: selectedColor === color }"
                :style="{ backgroundColor: color }"
                @click="selectedColor = color"
              ></button>
            </div>
          </div>

          <div class="form-row">
            <label>名称</label>
            <input v-model="name" class="input" placeholder="给助手起个名字" />
          </div>

          <div class="form-row">
            <label>一句话定位</label>
            <input v-model="role" class="input" placeholder="比如：文案写手 / 代码助手" />
          </div>

          <div class="form-row">
            <label>详细描述</label>
            <textarea
              v-model="description"
              class="textarea"
              rows="2"
              placeholder="这个助手擅长什么？"
            ></textarea>
          </div>

          <div class="form-row">
            <label>系统提示词（可选）</label>
            <textarea
              v-model="systemPrompt"
              class="textarea"
              rows="4"
              placeholder="自定义助手的性格、行为方式..."
            ></textarea>
          </div>
        </div>

        <footer class="modal-footer">
          <button
            v-if="isEditing"
            class="delete-btn"
            @click="handleDelete"
          >
            删除
          </button>
          <div class="footer-actions">
            <button class="btn-ghost" @click="emit('close')">取消</button>
            <button class="btn-primary" :disabled="!name.trim()" @click="save">
              保存
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.modal {
  width: 90%;
  max-width: 440px;
  max-height: 85vh;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border-soft);
}

.modal-header h2 {
  font-size: var(--font-md);
  font-weight: var(--font-medium);
}

.close-btn {
  width: 24px;
  height: 24px;
  position: relative;
  opacity: 0.4;
  transition: opacity var(--transition-fast);
}

.close-btn::before,
.close-btn::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 1px;
  background: currentColor;
}

.close-btn::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.close-btn::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.close-btn:hover {
  opacity: 1;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
}

.avatar-preview-row {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  margin-bottom: var(--space-5);
  padding: var(--space-4);
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-lg);
  font-weight: var(--font-semibold);
  flex-shrink: 0;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  flex: 1;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all var(--transition-fast);
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.active {
  border-color: #fff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.form-row {
  margin-bottom: var(--space-4);
}

.form-row label {
  display: block;
  font-size: var(--font-xs);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
}

.input,
.textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--color-text);
  font-family: inherit;
  transition: all var(--transition-fast);
  resize: vertical;
  outline: none;
}

.input:focus,
.textarea:focus {
  border-color: var(--color-accent);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border-soft);
}

.footer-actions {
  display: flex;
  gap: var(--space-3);
  margin-left: auto;
}

.btn-primary {
  padding: var(--space-2) var(--space-5);
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-ghost {
  padding: var(--space-2) var(--space-5);
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.btn-ghost:hover {
  color: var(--color-text);
  background: var(--color-bg-tertiary);
}

.delete-btn {
  font-size: var(--font-sm);
  color: var(--color-error);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  opacity: 0.8;
  transition: all var(--transition-fast);
}

.delete-btn:hover {
  opacity: 1;
  background: rgba(192, 108, 108, 0.1);
}
</style>
