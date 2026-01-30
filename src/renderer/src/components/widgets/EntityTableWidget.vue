<template>
  <el-card class="entity-table-widget" shadow="hover" :style="widgetStyle">
    <template #header>
      <div v-if="config.title" class="widget-header">
        <h3>{{ config.title }}</h3>
        <div class="widget-actions">
          <el-select
            v-model="selectedEntityType"
            size="small"
            style="width: 120px"
            @change="refreshData"
          >
            <el-option label="所有类型" value="all" />
            <el-option
              v-for="type in store.entityTypes"
              :key="type.id"
              :label="type.name"
              :value="type.id"
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

      <div v-else-if="entities.length === 0" class="widget-empty">
        <el-icon class="empty-icon"><Document /></el-icon>
        <div class="empty-message">暂无实体数据</div>
      </div>

      <div v-else class="entity-table-container">
        <div class="table-wrapper">
          <el-table
            :data="previewData"
            style="width: 100%"
            height="100%"
            stripe
            border
            size="small"
            @sort-change="handleSortChange"
          >
            <el-table-column
              v-for="column in tableColumns"
              :key="column"
              :prop="column"
              :label="getColumnLabel(column)"
              :sortable="config.enableSorting"
              :min-width="getColumnWidth(column)"
            >
              <template #default="scope">
                <div v-if="column === 'name'" class="cell-name">
                  <span class="name-text">{{ scope.row.name }}</span>
                  <span class="type-badge">{{ getTypeLabel(scope.row._type) }}</span>
                </div>
                <div v-else-if="column === 'createdAt'" class="cell-date">
                  {{ formatDate(scope.row.createdAt) }}
                </div>
                <div v-else-if="column === 'status'" class="cell-status">
                  <span v-if="scope.row.status" class="status-badge">
                    {{ scope.row.status }}
                  </span>
                  <span v-else>-</span>
                </div>
                <div v-else-if="column === 'priority'" class="cell-priority">
                  <el-tag
                    v-if="scope.row.priority"
                    :type="getPriorityType(scope.row.priority)"
                    size="small"
                  >
                    {{ scope.row.priority }}
                  </el-tag>
                  <span v-else>-</span>
                </div>
                <div v-else class="cell-value">
                  {{ scope.row[column] || '-' }}
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div v-if="entities.length > 0" class="table-footer">
        <div class="pagination-info">
          <span>显示 {{ previewData.length }} / {{ entities.length }} 条记录</span>
          <div class="pagination-controls">
            <el-button type="text" size="small" :disabled="currentPage === 1" @click="prevPage">
              上一页
            </el-button>
            <span class="page-info">第 {{ currentPage }} 页</span>
            <el-button
              type="text"
              size="small"
              :disabled="currentPage >= totalPages"
              @click="nextPage"
            >
              下一页
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../../stores/app'
import type { EntityTableWidgetConfig } from '../../../../shared/types/dashboards'
import type { Widget } from '../../../../shared/types/dashboards'
import type { EntityInstance } from '../../../../shared/types/entities'
import { Refresh, Loading, Warning, Document } from '@element-plus/icons-vue'

const props = defineProps<{
  widget: Widget
}>()

const store = useAppStore()
const loading = ref(false)
const error = ref<string | null>(null)
const entities = ref<EntityInstance[]>([])
const selectedEntityType = ref<string>('all')
const currentPage = ref(1)
let refreshTimer: NodeJS.Timeout | null = null

const config = computed<EntityTableWidgetConfig>(
  () => props.widget.config as EntityTableWidgetConfig
)

const widgetStyle = computed(() => ({
  height: '100%',
  border: '1px solid var(--el-border-color)',
  backgroundColor: 'var(--el-bg-color)'
}))

const pageSize = computed(() => config.value.pageSize || 10)

const totalPages = computed(() => {
  return Math.ceil(entities.value.length / pageSize.value)
})

const previewData = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  return entities.value.slice(startIndex, startIndex + pageSize.value)
})

onMounted(() => {
  fetchEntities()
  // 监听全局刷新事件
  document.addEventListener('refresh-widget', handleRefreshEvent)

  // 配置的自动刷新
  if (config.value.refreshInterval && config.value.refreshInterval > 0) {
    refreshTimer = setInterval(() => {
      fetchEntities()
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

// 表格列配置
const tableColumns = computed(() => {
  if (config.value.columns && config.value.columns.length > 0) {
    return config.value.columns
  }
  // 默认列
  return ['name', '_type', 'createdAt', 'status', 'priority']
})

const previewColumns = computed(() => {
  if (config.value.columns && config.value.columns.length > 0) {
    return config.value.columns.slice(0, 4) // 最多显示4列预览
  }

  // 默认列
  return ['name', '_type', 'createdAt', 'status']
})

function getTypeLabel(type: string): string {
  const entityType = store.entityTypes.find((t) => t.id === type)
  return entityType ? entityType.name : type
}

function getColumnLabel(column: string): string {
  const columnLabels: Record<string, string> = {
    name: '名称',
    _type: '类型',
    createdAt: '创建时间',
    status: '状态',
    priority: '优先级',
    category: '分类',
    tags: '标签',
    description: '描述'
  }
  return columnLabels[column] || column
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

async function fetchEntities() {
  loading.value = true
  error.value = null

  try {
    const { entities: allEntities } = store

    // 过滤实体类型
    let filtered = allEntities
    if (selectedEntityType.value && selectedEntityType.value !== 'all') {
      filtered = allEntities.filter((e) => e._type === selectedEntityType.value)
    }

    // 应用配置的列过滤
    if (config.value.columns && config.value.columns.length > 0) {
      // 这里可以添加列过滤逻辑
      filtered = filtered.map((entity) => {
        const filteredEntity: Record<string, any> = {}
        config.value.columns?.forEach((col) => {
          filteredEntity[col] = entity[col]
        })
        return filteredEntity as EntityInstance
      })
    }

    entities.value = filtered
    currentPage.value = 1 // 重置到第一页
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载数据失败'
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  await fetchEntities()
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

onMounted(() => {
  fetchEntities()
  // 监听全局刷新事件
  document.addEventListener('refresh-widget', handleRefreshEvent)

  // 配置的自动刷新
  if (config.value.refreshInterval && config.value.refreshInterval > 0) {
    refreshTimer = setInterval(() => {
      fetchEntities()
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

// 组件卸载时清理
onUnmounted(() => {
  document.removeEventListener('refresh-widget', handleRefreshEvent)
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

function getColumnWidth(column: string): string {
  const widths: Record<string, string> = {
    name: '180px',
    _type: '100px',
    createdAt: '120px',
    status: '100px',
    priority: '100px',
    description: '200px'
  }
  return widths[column] || '120px'
}

function getPriorityType(priority: string): string {
  const types: Record<string, string> = {
    高: 'danger',
    中: 'warning',
    低: 'success',
    urgent: 'danger',
    normal: 'info',
    low: 'success'
  }
  return types[priority.toLowerCase()] || 'info'
}

function handleSortChange({ prop, order }: { prop: string; order: string }) {
  if (!config.value.enableSorting) return

  const sorted = [...entities.value].sort((a, b) => {
    const aVal = a[prop]
    const bVal = b[prop]

    if (aVal === bVal) return 0
    if (order === 'ascending') {
      return aVal < bVal ? -1 : 1
    } else {
      return aVal > bVal ? -1 : 1
    }
  })

  entities.value = sorted
}

// 刷新事件监听
const handleRefreshEvent = () => {
  fetchEntities()
}

onMounted(() => {
  fetchEntities()
  // 监听全局刷新事件
  document.addEventListener('refresh-widget', handleRefreshEvent)

  // 配置的自动刷新
  if (config.value.refreshInterval && config.value.refreshInterval > 0) {
    refreshTimer = setInterval(() => {
      fetchEntities()
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
.entity-table-widget {
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

    .entity-table-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;

      .table-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;

        :deep(.el-table) {
          flex: 1;
          background-color: var(--el-bg-color-overlay);

          .el-table__header-wrapper {
            background-color: var(--el-bg-color-page);
          }

          .el-table__body-wrapper {
            max-height: calc(100% - 40px);
            overflow-y: auto;
          }
        }

        .cell-name {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .name-text {
            color: var(--el-text-color-primary);
            font-weight: 500;
          }

          .type-badge {
            font-size: 10px;
            padding: 1px 4px;
            background-color: var(--el-fill-color-light);
            color: var(--el-text-color-secondary);
            border-radius: 2px;
            width: fit-content;
          }
        }

        .cell-date {
          color: var(--el-text-color-secondary);
          font-size: 12px;
        }

        .cell-status {
          .status-badge {
            font-size: 11px;
            padding: 2px 6px;
            background-color: var(--el-color-primary-light-9);
            color: var(--el-color-primary);
            border-radius: 4px;
          }
        }

        .cell-priority {
          .el-tag {
            font-size: 11px;
            padding: 1px 6px;
          }
        }

        .cell-value {
          color: var(--el-text-color-secondary);
          font-size: 13px;
        }
      }
    }

    .table-footer {
      border-top: 1px solid var(--el-border-color);
      padding: 12px 16px;
      background-color: var(--el-bg-color-overlay);

      .pagination-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;

        span {
          color: var(--el-text-color-secondary);
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 8px;

          .page-info {
            color: var(--el-text-color-primary);
            font-weight: 500;
            min-width: 60px;
            text-align: center;
          }
        }
      }
    }
  }
}
</style>
