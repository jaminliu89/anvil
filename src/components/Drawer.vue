<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  open: boolean
  title?: string
  width?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: 360,
})

const emit = defineEmits<{ close: [] }>()

const visible = ref(props.open)

watch(() => props.open, (val) => {
  visible.value = val
})

function close() {
  emit('close')
}
</script>

<template>
  <Transition name="drawer">
    <div v-if="visible" class="drawer-overlay" @click.self="close">
      <div class="drawer-panel" :style="{ width: width + 'px' }">
        <div v-if="title" class="drawer-header">
          <span class="drawer-title">{{ title }}</span>
          <button class="drawer-close" @click="close" aria-label="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="drawer-body">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  height: 100%;
  background: var(--canvas);
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
}

.drawer-header {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--line-subtle);
}

.drawer-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.drawer-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--ink3);
  cursor: pointer;
  border-radius: 6px;
  padding: 0;
}

.drawer-close:hover {
  color: var(--ink);
  background: var(--muted);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
}

/* transitions */
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 200ms ease;
}
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 240ms cubic-bezier(0.2, 0, 0, 1);
}
</style>
