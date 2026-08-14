<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { initDsh, setupDshEventListeners } from '@/services/dsh'

let unlisten: (() => void) | null = null

onMounted(async () => {
  await initDsh()
  unlisten = setupDshEventListeners()
})

onUnmounted(() => {
  unlisten?.()
})
</script>

<template>
  <div id="app">
    <router-view />
  </div>
</template>
