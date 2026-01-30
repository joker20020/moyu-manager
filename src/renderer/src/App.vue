<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from './stores/app'
import { useAutoSave } from './composables/useAutoSave'

const appStore = useAppStore()
const autoSave = useAutoSave()
onMounted(() => {
  appStore.initTheme()
})
</script>

<style>
/* 全局样式在 main.css 中定义 */
</style>
