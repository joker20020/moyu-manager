<template>
  <el-card class="trend-chart-widget" shadow="hover" :style="widgetStyle">
    <template #header>
      <div v-if="config.title" class="widget-header">
        <h3>{{ config.title }}</h3>
        <div class="widget-actions">
          <el-select
            v-model="selectedPeriod"
            size="small"
            style="width: 120px"
            @change="refreshData"
          >
            <el-option label="最近7天" value="7d" />
            <el-option label="最近30天" value="30d" />
            <el-option label="最近90天" value="90d" />
          </el-select>
          <el-tooltip content="刷新" placement="top">
            <el-button type="text" size="small" :loading="loading" @click="refreshData">
              <el-icon><Refresh /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <div class="widget-content">
      <div v-if="loading" class="widget-loading">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <div v-else-if="error" class="widget-error">
        <el-icon class="error-icon"><Warning /></el-icon>
        <div class="error-message">{{ error }}</div>
        <el-button type="text" size="small" @click="refreshData">重试</el-button>
      </div>

      <div v-else-if="trendData.length === 0" class="widget-empty">
        <el-icon class="empty-icon"><TrendCharts /></el-icon>
        <div class="empty-message">暂无趋势数据</div>
      </div>

      <div v-else class="trend-chart">
        <BaseChart :option="chartOption" style="height: 100%; width: 100%" />
      </div>

      <div v-if="trendData.length > 0" class="chart-footer">
        <div class="chart-summary">
          <span class="summary-label">数据点:</span>
          <span class="summary-value">{{ trendData.length }}</span>
          <span class="summary-separator">|</span>
          <span class="summary-label">平均值:</span>
          <span class="summary-value">{{ averageValue.toFixed(1) }}</span>
          <span class="summary-separator">|</span>
          <span class="summary-label">趋势:</span>
          <span
            class="summary-value"
            :style="{ color: trendDirection >= 0 ? '#67c23a' : '#f56c6c' }"
          >
            {{ trendDirection >= 0 ? '↑' : '↓' }} {{ Math.abs(trendDirection).toFixed(1) }}%
          </span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../../stores/app'
import type { TrendChartWidgetConfig } from '../../../../shared/types/dashboards'
import type { Widget } from '../../../../shared/types/dashboards'
import type { EntityInstance } from '../../../../shared/types/entities'
import { Refresh, Loading, Warning, TrendCharts } from '@element-plus/icons-vue'
import BaseChart from './BaseChart.vue'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  widget: Widget
}>()

const store = useAppStore()
const loading = ref(false)
const error = ref<string | null>(null)
const trendData = ref<Array<{ time: number; value: number }>>([])
const selectedPeriod = ref<string>('7d')
let refreshTimer: NodeJS.Timeout | null = null

const config = computed<TrendChartWidgetConfig>(() => props.widget.config as TrendChartWidgetConfig)

const widgetStyle = computed(() => ({
  height: '100%',
  border: '1px solid var(--el-border-color)',
  backgroundColor: 'var(--el-bg-color)'
}))

const chartTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    line: '折线图',
    area: '面积图',
    bar: '柱状图'
  }
  return labels[config.value.chartType] || '图表'
})

const chartOption = computed<EChartsOption>(() => {
  const data = trendData.value
  const chartType = config.value.chartType

  if (data.length === 0) {
    return {
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'center',
        textStyle: {
          color: '#999',
          fontSize: 14
        }
      }
    }
  }

  // 时间格式化
  const timeLabels = data.map((item) => {
    const date = new Date(item.time)
    const daysAgo = Math.floor((Date.now() - item.time) / (1000 * 60 * 60 * 24))

    if (daysAgo === 0) return '今天'
    if (daysAgo === 1) return '昨天'
    if (daysAgo < 7) return `${daysAgo}天前`

    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  })

  // 基础配置
  const baseOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const param = params[0]
        const date = new Date(data[param.dataIndex].time)
        return `${date.toLocaleDateString('zh-CN')}<br/>${param.marker}${param.seriesName}: ${param.value}`
      }
    },
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    xAxis: {
      type: 'category',
      data: timeLabels,
      axisLine: {
        lineStyle: {
          color: '#ccc'
        }
      },
      axisTick: {
        lineStyle: {
          color: '#ccc'
        },
        alignWithLabel: true
      },
      axisLabel: {
        rotate: 45,
        margin: 8,
        fontSize: 11,
        color: '#666',
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '数量',
      nameLocation: 'end',
      nameGap: 20,
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      },
      axisLine: {
        lineStyle: {
          color: '#ccc'
        }
      },
      axisTick: {
        lineStyle: {
          color: '#ccc'
        }
      },
      axisLabel: {
        margin: 15,
        fontSize: 11,
        color: '#666',
        interval: 'auto',
        formatter: (value: number) => {
          // 处理大数字的显示
          if (Math.abs(value) >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`
          } else if (Math.abs(value) >= 1000) {
            return `${(value / 1000).toFixed(0)}k`
          }
          return value.toString()
        }
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
          color: '#e0e0e0'
        }
      },
      minInterval: 1
    },
    grid: {
      left: '15%',
      right: '4%',
      bottom: '20%',
      top: '20%',
      containLabel: true
    }
  }

  // 根据图表类型添加系列
  const seriesConfig: any = {
    name: '数量',
    data: data.map((item) => item.value),
    type: chartType === 'bar' ? 'bar' : 'line',
    smooth: chartType !== 'bar',
    itemStyle: {
      color: '#8a6df7'
    },
    lineStyle:
      chartType !== 'bar'
        ? {
            width: 3,
            shadowColor: 'rgba(138, 109, 247, 0.5)',
            shadowBlur: 8
          }
        : undefined,
    showSymbol: chartType !== 'bar' && data.length <= 30, // 数据点较少时显示标记
    symbolSize: 6,
    barWidth: chartType === 'bar' ? '60%' : undefined,
    barCategoryGap: chartType === 'bar' ? '20%' : undefined,
    emphasis: {
      focus: 'series',
      itemStyle: {
        color: '#ff6b9d',
        shadowColor: 'rgba(255, 107, 157, 0.8)',
        shadowBlur: 12,
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    },
    areaStyle:
      chartType === 'area'
        ? {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: 'rgba(138, 109, 247, 0.6)'
                },
                {
                  offset: 1,
                  color: 'rgba(138, 109, 247, 0.1)'
                }
              ]
            }
          }
        : undefined
  }

  return {
    ...baseOption,
    series: [seriesConfig]
  }
})

const averageValue = computed(() => {
  if (trendData.value.length === 0) return 0
  const sum = trendData.value.reduce((acc, item) => acc + item.value, 0)
  return sum / trendData.value.length
})

const trendDirection = computed(() => {
  if (trendData.value.length < 2) return 0

  const firstValue = trendData.value[0].value
  const lastValue = trendData.value[trendData.value.length - 1].value

  if (firstValue === 0) return 0
  return ((lastValue - firstValue) / firstValue) * 100
})

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const daysAgo = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))

  if (daysAgo === 0) {
    return '今天'
  } else if (daysAgo === 1) {
    return '昨天'
  } else if (daysAgo < 7) {
    return `${daysAgo}天前`
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  }
}

async function fetchTrendData() {
  loading.value = true
  error.value = null

  try {
    const { entities } = store

    // 过滤指定类型的实体
    const filtered = entities.filter((e) => e._type === config.value.entityType)

    // 获取时间范围
    const now = Date.now()
    const periodMs =
      {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      }[selectedPeriod.value] || 7 * 24 * 60 * 60 * 1000

    const startTime = now - periodMs

    // 按时间分组统计
    const timeBuckets: Record<number, number> = {}
    const bucketSize = periodMs / 20 // 将时间范围分成20个桶

    filtered.forEach((entity) => {
      if (entity.createdAt >= startTime) {
        const bucket = Math.floor((entity.createdAt - startTime) / bucketSize)
        timeBuckets[bucket] = (timeBuckets[bucket] || 0) + 1
      }
    })

    // 转换为趋势数据
    const data = Object.entries(timeBuckets)
      .map(([bucket, value]) => ({
        time: startTime + parseInt(bucket) * bucketSize,
        value: value
      }))
      .sort((a, b) => a.time - b.time)

    trendData.value = data
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载数据失败'
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  await fetchTrendData()
}

// 刷新事件监听
const handleRefreshEvent = () => {
  fetchTrendData()
}

onMounted(() => {
  fetchTrendData()
  // 监听全局刷新事件
  document.addEventListener('refresh-widget', handleRefreshEvent)

  // 配置的自动刷新
  if (config.value.refreshInterval && config.value.refreshInterval > 0) {
    refreshTimer = setInterval(() => {
      fetchTrendData()
    }, config.value.refreshInterval * 1000)
  }
})

// 组件卸载时清理
onUnmounted(() => {
  document.removeEventListener('refresh-widget', handleRefreshEvent)
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped lang="scss">
.trend-chart-widget {
  display: flex;
  flex-direction: column;
  height: 100%;

  :deep(.el-card__header) {
    border-bottom: 1px solid var(--el-border-color);
    padding: 12px 16px;
    background-color: var(--el-bg-color-overlay);
    flex-shrink: 0;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      font-size: 16px;
      color: var(--el-text-color-primary);
    }

    .widget-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .widget-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;

    .widget-loading,
    .widget-error,
    .widget-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--el-text-color-secondary);
      text-align: center;

      .loading-icon,
      .error-icon,
      .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }

      .error-message,
      .empty-message {
        margin: 8px 0;
        font-size: 14px;
        max-width: 80%;
        word-break: break-word;
      }
    }

    .trend-chart {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;

      .chart-placeholder {
        text-align: center;
        color: var(--el-text-color-secondary);
        width: 100%;

        p {
          margin: 12px 0 24px 0;
          font-size: 14px;
        }

        .data-preview {
          max-width: 300px;
          margin: 0 auto;
          background-color: var(--el-bg-color-overlay);
          border-radius: 8px;
          padding: 16px;
          border: 1px solid var(--el-border-color);

          .preview-header {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--el-border-color-light);
            font-weight: 500;
            color: var(--el-text-color-primary);
          }

          .preview-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--el-border-color-light);

            &:last-child {
              border-bottom: none;
            }

            .time {
              color: var(--el-text-color-secondary);
              font-size: 12px;
            }

            .value {
              font-weight: 500;
              color: var(--el-text-color-primary);
            }
          }

          .preview-more {
            padding: 8px 0;
            text-align: center;
            font-size: 11px;
            color: var(--el-text-color-placeholder);
          }
        }
      }
    }

    .chart-footer {
      border-top: 1px solid var(--el-border-color);
      padding: 12px 16px;
      background-color: var(--el-bg-color-overlay);

      .chart-summary {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 12px;

        .summary-label {
          color: var(--el-text-color-secondary);
        }

        .summary-value {
          color: var(--el-text-color-primary);
          font-weight: 500;
        }

        .summary-separator {
          color: var(--el-border-color);
          margin: 0 4px;
        }
      }
    }
  }
}
</style>
