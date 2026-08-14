<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Assistant } from '@/types/assistant'

const props = defineProps<{
  visible: boolean
  assistant?: Assistant | null // 有值=编辑，无值=新建
}>()

const emit = defineEmits<{
  close: []
  save: [assistant: Partial<Assistant>]
  delete: [id: string]
}>()

const name = ref('')
const role = ref('')
const description = ref('')
const avatar = ref('🤖')
const systemPrompt = ref('')

const isEditing = computed(() => !!props.assistant)
const title = computed(() => (isEditing.value ? '编辑助手' : '新建助手'))

const avatarOptions = [
  '🤖', '📝', '💻', '🔍', '🎨', '📊', '🎯', '💡', '📚', '🔧', '🗂️', '✨',
]

const colorOptions = [
  '#f59e0b', // writer - 琥珀
  '#3b82f6', // coder - 蓝
  '#8b5cf6', // researcher - 紫
  '#ec4899', // creator - 粉
  '#10b981', // 绿
  '#ef4444', // 红
  '#6b7280', // 灰
]

const selectedColor = ref(colorOptions[0])

watch(
  () => props.visible,
  (v) => {
    if (v && props.assistant) {
      // 编辑模式：填充数据
      name.value = props.assistant.name
      role.value = props.assistant.role
      description.value = props.assistant.description
      avatar.value = props.assistant.avatar
      selectedColor.value = props.assistant.color
      systemPrompt.value = props.assistant.systemPrompt || ''
    } else if (v) {
      // 新建模式：清空
      name.value = ''
      role.value = ''
      description.value = ''
      avatar.value = '🤖'
      selectedColor.value = colorOptions[0]
      systemPrompt.value = ''
    }
  },
)

function save() {
  if (!name.value.trim()) return
  emit('save', {
    name: name.value.trim(),
    role: role.value.trim(),
    description: description.value.trim(),
    avatar: avatar.value,
    color: selectedColor.value,
    systemPrompt: systemPrompt.value.trim(),
    dshProfile: 'web', // 自定义助手默认 web profile
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
          <button class="close-btn" @click="emit('close')">×</button>
        </header>

        <div class="modal-body">
          <div class="form-row">
            <label>头像</label>
            <div class="avatar-picker">
              <button
                v-for="emoji in avatarOptions"
                :key="emoji"
                class="avatar-option"
                :class="{ active: avatar === emoji }"
                @click="avatar = emoji"
              >
                {{ emoji }}
              </button>
            </div>
          </div>

          <div class="form-row">
            <label>主题色</label>
            <div class="color-picker">
              <button
                v-for="color in colorOptions"
                :key="color"
                class="color-option"
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
            <button class="btn-secondary" @click="emit('close')">取消</button>
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
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  width: 90%;
  max-width: 480px;
  max-height: 85vh;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border-soft);
}

.modal-header h2 {
  font-size: var(--font-lg);
  font-weight: var(--font-semibold);
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xl);
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
}

.form-row {
  margin-bottom: var(--space-4);
}

.form-row label {
  display: block;
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-2);
  color: var(--color-text);
}

.input,
.textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  color: var(--color-text);
  font-family: inherit;
  transition: all var(--transition-fast);
  resize: vertical;
}

.input:focus,
.textarea:focus {
  border-color: var(--color-accent);
  outline: none;
}

.avatar-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.avatar-option {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.avatar-option:hover {
  border-color: var(--color-border-strong);
}

.avatar-option.active {
  border-color: var(--color-accent);
  background: rgba(245, 158, 11, 0.1);
}

.color-picker {
  display: flex;
  gap: var(--space-2);
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all var(--transition-fast);
}

.color-option.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px var(--color-accent);
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
  color: #1a1a1a;
  font-weight: var(--font-semibold);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: var(--space-2) var(--space-5);
  background: var(--color-bg-tertiary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-border-strong);
}

.delete-btn {
  font-size: var(--font-sm);
  color: var(--color-error);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.delete-btn:hover {
  background: rgba(237, 73, 86, 0.1);
}
</style>
