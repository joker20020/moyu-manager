<template>
  <el-card class="entity-distribution-widget" shadow="hover" :style="widgetStyle">
    <template #header>
      <div v-if="config.title" class="widget-header">
        <h3>{{ config.title }}</h3>
        <div class="widget-actions">
          <el-select
            v-if="showEntityTypeSelector"
            v-model="selectedEntityType"
            size="small"
            style="width: 100px"
            @change="refreshData"
          >
            <el-option
              v-for="type in availableEntityTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
          <el-select
            v-model="selectedField"
            size="small"
            style="width: 120px"
            @change="refreshData"
          >
            <el-option
              v-for="field in availableFields"
              :key="field.value"
              :label="field.label"
              :value="field.value"
            />
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

      <div v-else-if="distributionData.length === 0" class="widget-empty">
        <el-icon class="empty-icon"><PieChart /></el-icon>
        <div class="empty-message">暂无分布数据</div>
      </div>

      <div v-else class="distribution-chart">
        <BaseChart :option="chartOption" style="height: 100%; width: 100%" />
      </div>

      <div v-if="distributionData.length > 0" class="chart-footer">
        <div class="chart-summary">
          <span class="summary-label">总计:</span>
          <span class="summary-value">{{ totalValue }}</span>
        </div>
        <div v-if="config.showPercentages" class="chart-legend">
          <div v-for="item in distributionData" :key="item.name" class="legend-item">
            <div class="legend-color" :style="{ backgroundColor: item.color }"></div>
            <span class="legend-label">{{ item.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../../stores/app'
import type { EntityDistributionWidgetConfig } from '../../../../shared/types/dashboards'
import type { Widget } from '../../../../shared/types/dashboards'
import type { EntityInstance } from '../../../../shared/types/entities'
import { Refresh, Loading, Warning, PieChart } from '@element-plus/icons-vue'
import BaseChart from './BaseChart.vue'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  widget: Widget
}>()

const store = useAppStore()
const loading = ref(false)
const error = ref<string | null>(null)
const distributionData = ref<Array<{ name: string; value: number; color: string }>>([])
const selectedField = ref<string>('')
const selectedEntityType = ref<string>('')

const config = computed<EntityDistributionWidgetConfig>(
  () => props.widget.config as EntityDistributionWidgetConfig
)

const widgetStyle = computed(() => ({
  height: '100%',
  border: '1px solid var(--el-border-color)',
  backgroundColor: 'var(--el-bg-color)'
}))

const chartTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    pie: '饼图',
    bar: '柱状图',
    doughnut: '环图'
  }
  return labels[config.value.chartType] || '图表'
})

const showEntityTypeSelector = computed(() => !config.value.entityType)

const availableEntityTypes = computed(() => {
  // 从store获取所有实体类型，转换为选择器选项格式
  return store.entityTypes.map((type) => ({
    value: type.id,
    label: type.name
  }))
})

const availableFields = computed(() => {
  const fields: Array<{ value: string; label: string }> = []
  const entityTypeId = selectedEntityType.value || config.value.entityType

  if (entityTypeId) {
    // 从store中查找实体类型定义
    const entityType = store.entityTypes.find((type) => type.id === entityTypeId)
    if (entityType) {
      // 合并固定字段和自定义字段
      const allFields = [...entityType.fixedFields, ...entityType.fields]
      allFields.forEach((field) => {
        // 跳过_id, _type等系统字段
        if (
          field.id === '_id' ||
          field.id === '_type' ||
          field.id === 'name' ||
          field.id === 'createdAt' ||
          field.id === 'updatedAt'
        ) {
          return
        }
        fields.push({ value: field.id, label: field.name })
      })
    }
  }

  // 如果没有找到字段，使用配置的字段
  if (
    config.value.distributionField &&
    !fields.some((f) => f.value === config.value.distributionField)
  ) {
    fields.push({ value: config.value.distributionField, label: config.value.distributionField })
  }

  return fields
})

const totalValue = computed(() => {
  return distributionData.value.reduce((sum, item) => sum + item.value, 0)
})

const chartOption = computed<EChartsOption>(() => {
  const data = distributionData.value
  const chartType = config.value.chartType

  if (chartType === 'pie' || chartType === 'doughnut') {
    return {
      title: {
        text: config.value.title || '实体分布',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: '分布',
          type: 'pie',
          radius: chartType === 'doughnut' ? ['40%', '70%'] : '50%',
          data: data.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: item.color }
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    }
  } else {
    // 柱状图
    return {
      title: {
        text: config.value.title || '实体分布',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.name)
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '数量',
          type: 'bar',
          data: data.map((item) => ({
            value: item.value,
            itemStyle: { color: item.color }
          }))
        }
      ]
    }
  }
})

const colorPalette = [
  '#8a6df7', // 紫色
  '#66ccff', // 蓝色
  '#ff9966', // 橙色
  '#9966ff', // 紫红色
  '#67c23a', // 绿色
  '#e6a23c', // 黄色
  '#f56c6c', // 红色
  '#909399' // 灰色
]

function getFieldValue(entity: EntityInstance, field: string): string {
  const value = entity[field]

  if (value === undefined || value === null) {
    return '未设置'
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '空'
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }

  return String(value)
}

async function fetchDistribution() {
  loading.value = true
  error.value = null

  try {
    const { entities } = store

    // 确定要分析的实体类型
    const entityType = selectedEntityType.value || config.value.entityType

    // 过滤指定类型的实体
    const filtered = entities.filter((e) => e._type === entityType)

    // 确定要分析的字段
    const field = selectedField.value || config.value.distributionField || 'category'

    // 计算分布
    const distribution: Record<string, number> = {}

    filtered.forEach((entity) => {
      const value = getFieldValue(entity, field)
      distribution[value] = (distribution[value] || 0) + 1
    })

    // 转换为数组格式并添加颜色
    const data = Object.entries(distribution)
      .map(([name, value], index) => ({
        name,
        value,
        color: colorPalette[index % colorPalette.length]
      }))
      .sort((a, b) => b.value - a.value) // 按值降序排序

    distributionData.value = data

    // 如果没有选中实体类型，选择第一个可用的
    if (
      !selectedEntityType.value &&
      !config.value.entityType &&
      availableEntityTypes.value.length > 0
    ) {
      selectedEntityType.value = availableEntityTypes.value[0].value
    }

    // 如果没有选中字段，选择第一个可用的
    if (!selectedField.value && availableFields.value.length > 0) {
      selectedField.value = availableFields.value[0].value
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载数据失败'
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  await fetchDistribution()
}

// 刷新事件监听
const handleRefreshEvent = () => {
  fetchDistribution()
}

onMounted(() => {
  fetchDistribution()
  // 监听全局刷新事件
  document.addEventListener('refresh-widget', handleRefreshEvent)
})

onUnmounted(() => {
  document.removeEventListener('refresh-widget', handleRefreshEvent)
})
</script>

<style scoped lang="scss">
.entity-distribution-widget {
  :deep(.el-card__header) {
    border-bottom: 1px solid var(--el-border-color);
    padding: 12px 16px;
    background-color: var(--el-bg-color-overlay);
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
    height: calc(100% - 56px); // 减去header高度
    display: flex;
    flex-direction: column;

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

    .distribution-chart {
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

          .data-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--el-border-color-light);

            &:last-child {
              border-bottom: none;
            }

            .data-label {
              font-weight: 500;
              color: var(--el-text-color-primary);
            }

            .data-value {
              color: var(--el-text-color-secondary);

              .percentage {
                margin-left: 4px;
                font-size: 12px;
                color: var(--el-text-color-placeholder);
              }
            }
          }
        }
      }
    }

    .chart-footer {
      border-top: 1px solid var(--el-border-color);
      padding: 12px 16px;
      background-color: var(--el-bg-color-overlay);
      display: flex;
      justify-content: space-between;
      align-items: center;

      .chart-summary {
        display: flex;
        align-items: center;
        gap: 8px;

        .summary-label {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }

        .summary-value {
          font-size: 16px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }
      }

      .chart-legend {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-end;

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;

          .legend-color {
            width: 10px;
            height: 10px;
            border-radius: 2px;
          }

          .legend-label {
            color: var(--el-text-color-secondary);
          }
        }
      }
    }
  }
}
</style>
