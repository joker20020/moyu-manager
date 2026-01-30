<template>
  <VChart
    :option="chartOption"
    :theme="theme"
    :loading="loading"
    autoresize
    style="width: 100%; height: 100%"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { EChartsOption } from 'echarts'

interface Props {
  option: EChartsOption
  theme?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  theme: 'light',
  loading: false
})

const chartOption = computed(() => props.option)
</script>
<style scoped>
.echarts{
  min-height: 200px;
}
</style>
