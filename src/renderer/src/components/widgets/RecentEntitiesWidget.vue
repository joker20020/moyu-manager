<template>
  <el-card class="recent-entities-widget" shadow="hover" :style="widgetStyle">
    <template #header>
      <div v-if="config.title" class="widget-header">
        <h3>{{ config.title }}</h3>
        <div class="widget-actions">
          <el-tooltip content="查看全部" placement="top">
            <el-button type="text" size="small" @click="viewAll"> 查看全部 </el-button>
          </el-tooltip>
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
        <div class="empty-message">暂无数据</div>
      </div>

      <div v-else class="entities-list">
        <el-table
          :data="entities"
          style="width: 100%"
          :height="tableHeight"
          @row-click="handleRowClick"
        >
          <el-table-column prop="name" label="名称" min-width="200">
            <template #default="scope">
              <div class="entity-name-cell">
                <div class="entity-name">{{ scope.row.name }}</div>
                <div v-if="scope.row.description" class="entity-description">
                  {{ scope.row.description }}
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column v-if="showEntityType" prop="_type" label="类型" width="80">
            <template #default="scope">
              <el-tag size="small" :type="getTypeTagType(scope.row._type)">
                {{ getTypeLabel(scope.row._type) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="createdAt" label="创建时间" width="120">
            <template #default="scope">
              {{ formatDate(scope.row.createdAt) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="60" align="center">
            <template #default="scope">
              <el-tooltip content="查看详情" placement="top">
                <el-button type="text" size="small" @click.stop="viewDetails(scope.row)">
                  <el-icon><View /></el-icon>
                </el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import type { RecentEntitiesWidgetConfig } from '../../../../shared/types/dashboards'
import type { Widget } from '../../../../shared/types/dashboards'
import type { EntityInstance } from '../../../../shared/types/entities'
import { Refresh, Loading, Warning, Document, View } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

const props = defineProps<{
  widget: Widget
}>()

const store = useAppStore()
const router = useRouter()
const loading = ref(false)
const error = ref<string | null>(null)
const entities = ref<EntityInstance[]>([])

const config = computed<RecentEntitiesWidgetConfig>(
  () => props.widget.config as RecentEntitiesWidgetConfig
)

const widgetStyle = computed(() => ({
  height: '100%',
  border: '1px solid var(--el-border-color)',
  backgroundColor: 'var(--el-bg-color)'
}))

const tableHeight = computed(() => {
  const entityCount = Math.min(entities.value.length, config.value.limit || 10)
  return Math.max(entityCount * 56 + 56, 200) // 行高+表头
})

const showEntityType = computed(() => {
  if (config.value.showColumns) {
    return config.value.showColumns.includes('type')
  }
  return !config.value.entityType || config.value.entityType === 'all'
})

function getTypeLabel(type: string): string {
  const entityType = store.entityTypes.find((t) => t.id === type)
  return entityType ? entityType.name : type
}

function getTypeTagType(type: string): string {
  const typeColors: Record<string, string> = {
    task: 'primary',
    contact: 'success',
    note: 'info',
    project: 'warning'
  }
  return typeColors[type] || 'info'
}

// function getRowClassName({ row }: { row: EntityInstance }) {
//   if (row._type === 'task' && row.status === 'completed') {
//     return 'completed-task'
//   }
//   return ''
// }

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return '今天'
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  }
}

async function fetchEntities() {
  loading.value = true
  error.value = null

  try {
    const { entities: allEntities } = store
    console.log('RecentEntitiesWidget: fetching entities, total:', allEntities.length)

    // 过滤实体类型
    let filtered = allEntities
    if (config.value.entityType && config.value.entityType !== 'all') {
      filtered = allEntities.filter((e) => e._type === config.value.entityType)
      console.log(
        'RecentEntitiesWidget: filtered by type',
        config.value.entityType,
        'count:',
        filtered.length
      )
    }

    // 排序
    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[config.value.sortBy]
      const bValue = b[config.value.sortBy]

      // 处理undefined/null值
      if (aValue === undefined || aValue === null) return config.value.sortOrder === 'asc' ? -1 : 1
      if (bValue === undefined || bValue === null) return config.value.sortOrder === 'asc' ? 1 : -1

      // 数字比较
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return config.value.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      }

      // 字符串比较
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return config.value.sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      // 日期比较（时间戳）
      if (config.value.sortBy === 'createdAt' || config.value.sortBy === 'updatedAt') {
        const aTime = typeof aValue === 'number' ? aValue : new Date(aValue).getTime()
        const bTime = typeof bValue === 'number' ? bValue : new Date(bValue).getTime()
        return config.value.sortOrder === 'asc' ? aTime - bTime : bTime - aTime
      }

      // 默认按创建时间排序
      return config.value.sortOrder === 'asc'
        ? a.createdAt - b.createdAt
        : b.createdAt - a.createdAt
    })

    console.log('RecentEntitiesWidget: sorted entities, first few:', sorted.slice(0, 3))

    // 限制数量
    const limit = config.value.limit || 10
    entities.value = sorted.slice(0, limit)
    console.log(
      'RecentEntitiesWidget: displaying',
      entities.value.length,
      'of',
      sorted.length,
      'entities'
    )
  } catch (err) {
    console.error('RecentEntitiesWidget: error fetching entities', err)
    error.value = err instanceof Error ? err.message : '加载数据失败'
  } finally {
    loading.value = false
  }
}

async function refreshData() {
  await fetchEntities()
}

function viewAll() {
  // 导航到实体列表页，如果配置了实体类型则传递类型参数
  const query: Record<string, string> = {}
  if (config.value.entityType && config.value.entityType !== 'all') {
    query.type = config.value.entityType
  }
  router.push({
    path: '/entities',
    query
  })
}

function viewDetails(entity: EntityInstance) {
  // 打开实体详情对话框
  ElMessageBox.alert(
    `实体详情：
名称：${entity.name}
类型：${getTypeLabel(entity._type)}
创建时间：${formatDate(entity.createdAt)}
${entity.description ? `描述：${entity.description}` : ''}`,
    '实体详情',
    {
      confirmButtonText: '关闭',
      callback: () => {
        // 可选的后续操作
      }
    }
  )
}

function handleRowClick(entity: EntityInstance) {
  viewDetails(entity)
}

// 刷新事件监听
const handleRefreshEvent = () => {
  fetchEntities()
}

onMounted(() => {
  fetchEntities()
  // 监听全局刷新事件
  document.addEventListener('refresh-widget', handleRefreshEvent)
})

onUnmounted(() => {
  document.removeEventListener('refresh-widget', handleRefreshEvent)
})
</script>

<style scoped lang="scss">
.recent-entities-widget {
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
      gap: 4px;
    }
  }

  .widget-content {
    height: calc(100% - 56px); // 减去header高度

    .widget-loading,
    .widget-error,
    .widget-empty {
      height: 100%;
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

    .entities-list {
      height: 100%;

      :deep(.el-table) {
        background-color: transparent;

        .el-table__header {
          background-color: var(--el-bg-color-overlay);
        }

        .el-table__row {
          cursor: pointer;
          transition: background-color 0.2s;

          &:hover {
            background-color: var(--el-bg-color-overlay);
          }
        }
      }
    }

    .entity-name-cell {
      .entity-name {
        font-weight: 500;
        color: var(--el-text-color-primary);
        margin-bottom: 2px;
      }

      .entity-description {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}
</style>
