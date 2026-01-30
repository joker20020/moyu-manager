<template>
  <el-card class="statistics-widget" shadow="hover" :style="widgetStyle">
    <template #header>
      <div v-if="config.title" class="widget-header">
        <h3>{{ config.title }}</h3>
        <div class="widget-actions">
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

      <div v-else class="statistics-grid">
        <div
          v-for="(stat, index) in statistics"
          :key="`${stat.metric}-${stat.label}-${index}`"
          class="stat-item"
        >
          <div class="stat-icon" :style="{ backgroundColor: getColor(index) }">
            <el-icon :size="20" :color="getIconColor(index)">
              <component :is="getIcon(stat.metric)" />
            </el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">
              {{ stat.label || getMetricLabel(stat.metric) }}
            </div>
            <div
              v-if="stat.trend !== undefined"
              class="stat-trend"
              :style="{ color: stat.trend >= 0 ? '#67c23a' : '#f56c6c' }"
            >
              {{ stat.trend >= 0 ? '↑' : '↓' }}{{ Math.abs(stat.trend) }}%
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../../stores/app'
import type { StatisticsWidgetConfig, StatisticMetric } from '../../../../shared/types/dashboards'
import type { Widget } from '../../../../shared/types/dashboards'
import { Refresh, Loading, Warning, List, DataLine, TrendCharts } from '@element-plus/icons-vue'

const props = defineProps<{
  widget: Widget
}>()

const store = useAppStore()
const loading = ref(false)
const error = ref<string | null>(null)
const statistics = ref<
  Array<{ metric: StatisticMetric; value: number; trend?: number; label?: string }>
>([])

const config = computed<StatisticsWidgetConfig>(() => props.widget.config as StatisticsWidgetConfig)

const widgetStyle = computed(() => ({
  height: '100%',
  border: '1px solid var(--el-border-color)',
  backgroundColor: 'var(--el-bg-color)'
}))

const iconMap: Record<string, any> = {
  'total-entities': DataLine,
  'by-type': List,
  'recent-activity': TrendCharts
}

const colorPalette = [
  'rgba(138, 109, 247,0.1)',
  'rgba(102, 204, 255,0.1)',
  'rgba(255, 153, 102,0.1)',
  'rgba(153, 102, 255,0.1)'
]

const iconColorPalette = ['#8a6df7', '#66ccff', '#ff9966', '#9966ff']

function getIcon(metric: StatisticMetric) {
  return iconMap[metric] || DataLine
}

function getColor(index: number) {
  return colorPalette[index % colorPalette.length]
}

function getIconColor(index: number) {
  return iconColorPalette[index % iconColorPalette.length]
}

function getMetricLabel(metric: StatisticMetric): string {
  const labels: Record<StatisticMetric, string> = {
    'total-entities': '总实体数',
    'by-type': '按类型',
    'recent-activity': '最近活动'
  }
  return labels[metric]
}

function calculateEntityTrend(entityList: any[]): number {
  if (entityList.length === 0) return 0

  const now = Date.now()
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000

  const recentCount = entityList.filter((e) => e.createdAt >= oneWeekAgo).length
  const previousCount = entityList.filter(
    (e) => e.createdAt >= twoWeeksAgo && e.createdAt < oneWeekAgo
  ).length

  if (previousCount === 0) return recentCount > 0 ? 100 : 0

  const trend = ((recentCount - previousCount) / previousCount) * 100
  return Math.round(trend * 10) / 10
}

async function fetchStatistics() {
  loading.value = true
  error.value = null

  try {
    const { entities } = store

    // 根据entityType过滤实体
    let filteredEntities = entities
    if (config.value.entityType && config.value.entityType !== 'all') {
      filteredEntities = entities.filter((e) => e._type === config.value.entityType)
    }

    // 计算统计数据
    const stats = [] as Array<{
      metric: StatisticMetric
      value: number
      trend?: number
      label?: string
    }>

    for (const metric of config.value.metrics) {
      switch (metric) {
        case 'total-entities':
          stats.push({
            metric,
            value: filteredEntities.length,
            trend: calculateEntityTrend(filteredEntities)
          })
          break

        case 'by-type': {
          if (config.value.entityType && config.value.entityType !== 'all') {
            // 如果指定了entityType，只显示该类型的统计
            stats.push({
              metric,
              value: filteredEntities.length,
              trend: calculateEntityTrend(filteredEntities),
              label: getEntityTypeName(config.value.entityType)
            })
          } else {
            // 显示所有类型的统计（动态获取）
            const { entityTypes } = store

            entityTypes.forEach((entityType) => {
              const count = entities.filter((e) => e._type === entityType.id).length

              // 显示所有类型，包括计数为零的
              stats.push({
                metric,
                value: count,
                trend: calculateEntityTrend(entities.filter((e) => e._type === entityType.id)),
                label: entityType.name
              })
            })
          }
          break
        }

        case 'recent-activity': {
          // 统计最近7天、30天、90天的实体数量
          const now = Date.now()
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
          const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000

          const recent7Days = filteredEntities.filter((e) => e.createdAt >= sevenDaysAgo).length
          const recent30Days = filteredEntities.filter((e) => e.createdAt >= thirtyDaysAgo).length
          const recent90Days = filteredEntities.filter((e) => e.createdAt >= ninetyDaysAgo).length

          stats.push({
            metric,
            value: recent7Days,
            label: '最近7天'
          })

          stats.push({
            metric,
            value: recent30Days,
            label: '最近30天'
          })

          stats.push({
            metric,
            value: recent90Days,
            label: '最近90天'
          })
          break
        }

        default:
          stats.push({
            metric,
            value: 0,
            trend: 0
          })
      }
    }

    statistics.value = stats
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载数据失败'
  } finally {
    loading.value = false
  }
}

function getEntityTypeName(typeId: string): string {
  const { entityTypes } = store
  const entityType = entityTypes.find((et) => et.id === typeId)
  return entityType?.name || typeId
}

function getTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    task: '任务',
    contact: '联系人',
    note: '笔记',
    project: '项目'
  }
  return typeLabels[type] || type
}

async function refreshData() {
  await fetchStatistics()
}

// 刷新事件监听
const handleRefreshEvent = () => {
  fetchStatistics()
}

let refreshTimer: NodeJS.Timeout | null = null

// 自动刷新
onMounted(() => {
  fetchStatistics()

  // 监听全局刷新事件
  document.addEventListener('refresh-widget', handleRefreshEvent)

  // 配置的自动刷新
  if (config.value.refreshInterval && config.value.refreshInterval > 0) {
    refreshTimer = setInterval(() => {
      fetchStatistics()
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
.statistics-widget {
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
      gap: 4px;
    }
  }

  .widget-content {
    height: calc(100% - 56px); // 减去header高度
    display: flex;
    flex-direction: column;

    .widget-loading,
    .widget-error {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--el-text-color-secondary);
      text-align: center;

      .loading-icon,
      .error-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }

      .error-message {
        margin: 8px 0;
        font-size: 14px;
        max-width: 80%;
        word-break: break-word;
      }
    }

    .statistics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      padding: 16px;

      .stat-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        background-color: var(--el-bg-color-overlay);
        border: 1px solid var(--el-border-color);

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;

          .el-icon {
            font-size: 20px;
          }
        }

        .stat-info {
          flex: 1;

          .stat-value {
            font-size: 20px;
            font-weight: 600;
            color: var(--el-text-color-primary);
            line-height: 1;
            margin-bottom: 4px;
          }

          .stat-label {
            font-size: 12px;
            color: var(--el-text-color-secondary);
            margin-bottom: 4px;
          }

          .stat-trend {
            display: flex;
            align-items: center;
            gap: 2px;
            font-size: 11px;
            font-weight: 500;

            .el-icon {
              font-size: 12px;
            }
          }
        }
      }
    }
  }
}
</style>
