<template>
  <div class="dashboards-view">
    <div class="view-header">
      <h2>数据看板</h2>
      <p class="view-description">可视化展示您的实体数据</p>
    </div>

    <div class="dashboard-controls">
      <el-row :gutter="2">
        <el-col :span="6">
          <el-select v-model="selectedDashboard" placeholder="选择看板" style="width: 100%">
            <el-option
              v-for="dashboard in dashboards"
              :key="dashboard.id"
              :label="dashboard.name"
              :value="dashboard.id"
            />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select
            v-model="refreshInterval"
            placeholder="自动刷新"
            @change="handleRefreshIntervalChange"
          >
            <el-option label="关闭" :value="0" />
            <el-option label="30秒" :value="30" />
            <el-option label="1分钟" :value="60" />
            <el-option label="5分钟" :value="300" />
            <el-option label="10分钟" :value="600" />
          </el-select>
        </el-col>
        <el-col :span="14">
          <div class="control-buttons">
            <el-button type="primary" @click="refreshDashboard" :loading="dashboardLoading">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-button @click="configureDashboard">
              <el-icon><Setting /></el-icon>
              配置
            </el-button>
            <el-button @click="addWidgets">
              <el-icon><Plus /></el-icon>
              添加小组件
            </el-button>
            <el-button @click="createNewDashboard">
              <el-icon><FolderAdd /></el-icon>
              新建看板
            </el-button>
            <el-button
              type="danger"
              @click="deleteDashboard"
              :disabled="!currentDashboard"
              :loading="deletingDashboard"
            >
              <el-icon><Delete /></el-icon>
              删除看板
            </el-button>
          </div>
        </el-col>
      </el-row>
    </div>

    <div v-if="!currentDashboard" class="dashboard-empty">
      <el-empty description="请选择一个看板或创建新看板">
        <el-button type="primary" @click="createNewDashboard">创建看板</el-button>
      </el-empty>
    </div>

    <ErrorBoundary @error="handleComponentError">
      <div class="dashboard-grid">
        <!-- 全局加载指示器 -->
        <div v-if="isDataLoading" class="global-loading">
          <!-- <el-loading-spinner size="large" /> -->
          <p>正在加载看板数据...</p>
        </div>
      </div>

      <div v-if="widgets.length === 0" class="widgets-empty">
        <el-empty description="该看板暂无小部件">
          <el-button type="primary" @click="addWidgets">添加小部件</el-button>
        </el-empty>
      </div>

      <!-- 动态小部件渲染 -->
      <div v-else class="widgets-container" :key="currentDashboard?.id || 'empty'">
        <draggable
          v-model="widgets"
          class="widgets-grid"
          :animation="200"
          :delay="100"
          :delay-on-touch-only="true"
          ghost-class="widget-ghost"
          chosen-class="widget-chosen"
          drag-class="widget-drag"
          item-key="id"
          @end="handleWidgetReorder"
        >
          <template #item="{ element: widget }">
            <div
              class="widget-item"
              :style="getWidgetStyle(widget)"
              data-widget
              @contextmenu.prevent="handleWidgetContextMenu(widget, $event)"
            >
              <!-- 统计小部件 -->
              <StatisticsWidget
                v-if="widget.type === WidgetType.STATISTICS"
                :key="`statistics-${widget.id}`"
                :widget="widget"
              />

              <!-- 最近实体小部件 -->
              <RecentEntitiesWidget
                v-else-if="widget.type === WidgetType.RECENT_ENTITIES"
                :key="`recent-${widget.id}`"
                :widget="widget"
              />

              <!-- 实体分布小部件 -->
              <EntityDistributionWidget
                v-else-if="widget.type === WidgetType.ENTITY_DISTRIBUTION"
                :key="`distribution-${widget.id}`"
                :widget="widget"
              />

              <!-- 趋势图表小部件 -->
              <TrendChartWidget
                v-else-if="widget.type === WidgetType.TREND_CHART"
                :key="`trend-${widget.id}`"
                :widget="widget"
              />

              <!-- 实体表格小部件 -->
              <EntityTableWidget
                v-else-if="widget.type === WidgetType.ENTITY_TABLE"
                :key="`table-${widget.id}`"
                :widget="widget"
              />

              <!-- 自定义小部件 -->
              <div
                v-else-if="widget.type === WidgetType.CUSTOM"
                :key="`custom-${widget.id}`"
                class="custom-widget-placeholder"
              >
                <el-icon :size="48" color="var(--el-text-color-secondary)">
                  <Tools />
                </el-icon>
                <p>自定义小部件</p>
                <small>通过插件系统扩展</small>
              </div>

              <!-- 小部件操作按钮 -->
              <div class="widget-controls">
                <el-button
                  type="text"
                  size="small"
                  class="control-btn"
                  @click.stop="editWidget(widget)"
                >
                  <el-icon><Setting /></el-icon>
                </el-button>
                <el-button
                  type="text"
                  size="small"
                  class="control-btn danger"
                  @click.stop="removeWidget(widget)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </template>
        </draggable>
      </div>

      <!-- 基础看板 (如果没有小部件配置时的默认布局) -->
      <div v-if="showDefaultLayout" class="default-dashboard-layout">
        <!-- 保留原有的统计卡片作为基础布局 -->
        <el-row :gutter="16" class="stats-row">
          <el-col :span="6">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-icon" style="background-color: rgba(138, 109, 247, 0.1)">
                  <el-icon style="color: #8a6df7"><TrendCharts /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ totalEntities }}</div>
                  <div class="stat-label">总实体数</div>
                </div>
                <div class="stat-trend">
                  <el-icon color="#67c23a"><Top /></el-icon>
                  <span style="color: #67c23a">12%</span>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-icon" style="background-color: rgba(102, 204, 255, 0.1)">
                  <el-icon style="color: #66ccff"><List /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ taskCount }}</div>
                  <div class="stat-label">任务数量</div>
                </div>
                <div class="stat-trend">
                  <el-icon color="#67c23a"><Top /></el-icon>
                  <span style="color: #67c23a">8%</span>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-icon" style="background-color: rgba(255, 153, 102, 0.1)">
                  <el-icon style="color: #ff9966"><User /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ contactCount }}</div>
                  <div class="stat-label">联系人</div>
                </div>
                <div class="stat-trend">
                  <el-icon color="#67c23a"><Top /></el-icon>
                  <span style="color: #67c23a">5%</span>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-icon" style="background-color: rgba(153, 102, 255, 0.1)">
                  <el-icon style="color: #9966ff"><DataLine /></el-icon>
                </div>
                <div class="stat-info">
                  <div class="stat-value">{{ noteCount }}</div>
                  <div class="stat-label">笔记数</div>
                </div>
                <div class="stat-trend">
                  <el-icon color="#f56c6c"><Bottom /></el-icon>
                  <span style="color: #f56c6c">3%</span>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </ErrorBoundary>

    <!-- 配置对话框 -->
    <DashboardConfigDialog
      v-model="showConfigDialog"
      :mode="configDialogMode"
      :editing-dashboard="editingDashboard"
      :editing-widget="editingWidget"
      :entity-types="store.entityTypes"
      @confirm="handleConfigConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  computed,
  defineAsyncComponent,
  onUnmounted,
  watch,
  toRaw,
  nextTick
} from 'vue'
import { debounce } from 'lodash'
import { ElMessageBox } from 'element-plus'
import draggable from 'vuedraggable'
import { useAppStore } from '../stores/app'
import { storeToRefs } from 'pinia'
import { Dashboard, Widget, WidgetType } from '../../../shared/types/dashboards'
import {
  Refresh,
  Setting,
  Plus,
  FolderAdd,
  Download,
  TrendCharts,
  Top,
  Bottom,
  List,
  User,
  DataLine,
  Tools,
  Delete
} from '@element-plus/icons-vue'
import MessageService from '../utils/messageService'

// 导入小部件组件
import StatisticsWidget from '../components/widgets/StatisticsWidget.vue'
import RecentEntitiesWidget from '../components/widgets/RecentEntitiesWidget.vue'
import EntityDistributionWidget from '../components/widgets/EntityDistributionWidget.vue'
import TrendChartWidget from '../components/widgets/TrendChartWidget.vue'
import EntityTableWidget from '../components/widgets/EntityTableWidget.vue'

// 导入配置对话框
import DashboardConfigDialog from '../components/DashboardConfigDialog.vue'
import ErrorBoundary from '../components/ErrorBoundary.vue'

const store = useAppStore()
const { entities } = storeToRefs(store)

// 响应式状态
const selectedDashboard = ref<string>('')
const chartType = ref('pie')
const trendPeriod = ref('7d')
const dashboardLoading = ref(false)
const deletingDashboard = ref(false)
const isDataLoading = ref(false)
const refreshInterval = ref(0)
let refreshTimer: NodeJS.Timeout | null = null

// 配置对话框状态
const showConfigDialog = ref(false)
const configDialogMode = ref<'dashboard' | 'widget'>('widget')
const editingDashboard = ref<any>(null)
const editingWidget = ref<any>(null)

// 看板数据
const dashboards = ref<Dashboard[]>([])
const widgets = ref<Widget[]>([])
const currentDashboard = ref<Dashboard | null>(null)

// 统计数据
const totalEntities = computed(() => entities.value.length)

const taskCount = computed(() => {
  return entities.value.filter((e) => e._type === 'task').length
})

const contactCount = computed(() => {
  return entities.value.filter((e) => e._type === 'contact').length
})

const noteCount = computed(() => {
  return entities.value.filter((e) => e._type === 'note').length
})

// 最近任务
const recentTasks = computed(() => {
  const tasks = entities.value
    .filter((e) => e._type === 'task')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)
    .map((task) => ({
      name: task.name,
      priority: task.priority || '中',
      createdAt: task.createdAt
    }))
  return tasks
})

// 最近笔记
const recentNotes = computed(() => {
  const notes = entities.value
    .filter((e) => e._type === 'note')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)
    .map((note) => ({
      name: note.name,
      category: note.category || '其他',
      createdAt: note.createdAt
    }))
  return notes
})

// 获取看板数据
const fetchDashboards = async () => {
  try {
    const data = await window.api.dashboards.getDashboards()
    dashboards.value = data
    if (data.length > 0 && !currentDashboard.value) {
      selectedDashboard.value = data[0].id
      await loadDashboard(data[0].id)
    }
  } catch (error) {
    console.error('Failed to fetch dashboards:', error)
  }
}

// 加载看板
const loadDashboard = async (dashboardId: string) => {
  isDataLoading.value = true
  try {
    const dashboard = await window.api.dashboards.getDashboard(dashboardId)
    if (dashboard) {
      // 等待DOM更新完成
      await nextTick()

      // 设置新的当前看板和widgets
      currentDashboard.value = dashboard
      const widgetData = await (
        await window.api.dashboards.getWidgets(dashboardId)
      ).sort((widgeta, widgetb) => widgeta.position.y - widgetb.position.y)
      widgets.value = widgetData
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error)
    MessageService.error('加载看板失败')
    widgets.value = []
  } finally {
    isDataLoading.value = false
  }
}

// 处理看板选择变化
const handleDashboardChange = async (dashboardId: string) => {
  dashboardLoading.value = true
  isDataLoading.value = true
  try {
    await loadDashboard(dashboardId)
    // 等待DOM完全渲染
    await nextTick()
    // 短暂延迟确保所有观察者完成
    await new Promise((resolve) => setTimeout(resolve, 100))
  } finally {
    dashboardLoading.value = false
    isDataLoading.value = false
  }
}

// 初始化加载数据
onMounted(async () => {
  await store.fetchEntities()
  await fetchDashboards()
})

// 监听看板选择变化
watch(selectedDashboard, async (newDashboardId, oldDashboardId) => {
  if (newDashboardId && newDashboardId !== oldDashboardId) {
    await handleDashboardChange(newDashboardId)
  }
})

// 清理定时器
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

// 处理配置确认
const handleConfigConfirm = async (result: any) => {
  try {
    if (result.type === 'dashboard') {
      // 处理看板配置
      if (editingDashboard.value) {
        // 更新现有看板
        const updatedDashboard = await window.api.dashboards.updateDashboard(
          toRaw(editingDashboard.value.id),
          result.data
        )
        if (updatedDashboard) {
          const index = dashboards.value.findIndex((d) => d.id === updatedDashboard.id)
          if (index !== -1) {
            dashboards.value[index] = updatedDashboard
          }

          if (updatedDashboard && currentDashboard.value?.id === updatedDashboard.id) {
            currentDashboard.value = updatedDashboard
          }
        } else {
          // 创建新看板
          const newDashboard = await window.api.dashboards.createDashboard(result.data)
          if (newDashboard) {
            dashboards.value.push(newDashboard)
            selectedDashboard.value = newDashboard.id
            await loadDashboard(newDashboard.id)
          }
        }
      }
    } else if (result.type === 'widget') {
      // 处理小部件配置
      if (!currentDashboard.value) {
        MessageService.error('请先选择或创建看板')
        return
      }
      console.log('result.data', result)
      if (editingWidget.value) {
        // 更新现有小部件
        const updatedWidget = await window.api.dashboards.updateWidget(
          toRaw(currentDashboard.value.id),
          toRaw(editingWidget.value.id),
          {
            type: result.data.type,
            config: result.data.config,
            position: toRaw(editingWidget.value.position)
          }
        )
        if (updatedWidget) {
          const index = widgets.value.findIndex((w) => w.id === updatedWidget.id)
          if (index !== -1 && updatedWidget) {
            widgets.value[index] = updatedWidget
          }
        }
      } else {
        // 添加新小部件
        console.log(toRaw(result.data.config))
        const newWidget = await window.api.dashboards.addWidget(toRaw(currentDashboard.value.id), {
          type: result.data.type,
          config: toRaw(result.data.config),
          position: { x: 0, y: 0, w: 2, h: 1 }
        })

        widgets.value.push(newWidget)
      }
    }
    await window.api.files.save()
  } catch (error) {
    console.error('Failed to save configuration:', error)
    MessageService.error('配置保存失败')
  }
}

// 处理组件错误
const handleComponentError = (error: Error, errorInfo: any) => {
  console.error('Dashboard component error:', error, errorInfo)
  MessageService.error('看板组件出现错误，已自动恢复')
}

// 处理小部件右键菜单
const handleWidgetContextMenu = (widget: Widget, event: MouseEvent) => {
  // 阻止默认右键菜单
  event.preventDefault()

  // TODO: 实现右键菜单功能（复制、编辑、删除等）
  console.log('Context menu for widget:', widget)

  // 可以在这里显示右键菜单
  // MessageService.info('右键菜单功能开发中...')
}

// 处理小部件重新排序 - 防抖处理
const handleWidgetReorder = debounce(async (event: any) => {
  try {
    if (!currentDashboard.value) return

    // 更新小部件位置信息
    const updatedWidgets = widgets.value.map((widget, index) => {
      // 根据widget大小和索引计算位置
      const w = widget.position?.w || 2 // 默认宽度为2列
      const columns = 2 // 网格总列数

      return {
        ...widget,
        position: {
          ...widget.position,
          x: (index * w) % columns,
          y: Math.floor((index * w) / columns),
          w: widget.position?.w || 2,
          h: widget.position?.h || 1
        }
      }
    })

    // 更新到DashboardService
    console.log('updatedWidgets', updatedWidgets)
    for (const widget of updatedWidgets) {
      await window.api.dashboards.updateWidget(currentDashboard.value.id, widget.id, {
        position: widget.position
      })
    }

    widgets.value = updatedWidgets
    MessageService.success('布局已更新')
  } catch (error) {
    console.error('Failed to update widget positions:', error)
    MessageService.error('布局更新失败')
  }
}, 500)

// 编辑小部件
const editWidget = (widget: any) => {
  configDialogMode.value = 'widget'
  editingWidget.value = widget
  showConfigDialog.value = true
}

// 删除小部件
const removeWidget = async (widget: any) => {
  try {
    await ElMessageBox.confirm(`确定要删除小部件"${widget.config.title}"吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await window.api.dashboards.removeWidget(currentDashboard.value!.id, widget.id)

    const index = widgets.value.findIndex((w) => w.id === widget.id)
    if (index !== -1) {
      widgets.value.splice(index, 1)
    }

    MessageService.success('小部件删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to remove widget:', error)
      MessageService.error('删除小部件失败')
    }
  }
}

// 刷新数据
const refreshDashboard = async () => {
  dashboardLoading.value = true
  isDataLoading.value = true
  try {
    await store.fetchEntities()
    if (currentDashboard.value) {
      await loadDashboard(currentDashboard.value.id)
    }
    // 手动刷新时也触发所有widget的刷新
    refreshAllWidgets()
  } finally {
    dashboardLoading.value = false
    isDataLoading.value = false
  }
}

// 处理刷新间隔变化 - 防抖处理
const handleRefreshIntervalChange = debounce((interval: number) => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }

  if (interval > 0) {
    refreshTimer = setInterval(() => {
      refreshDashboard()
    }, interval * 1000)
  }

  MessageService.success(`自动刷新间隔已设置为${interval > 0 ? interval + '秒' : '关闭'}`)
}, 500)

// 刷新所有小部件
const refreshAllWidgets = () => {
  // 触发组件事件让所有小部件刷新数据
  document.querySelectorAll('[data-widget]').forEach((el) => {
    const event = new CustomEvent('refresh-widget', { bubbles: true })
    el.dispatchEvent(event)
  })
}

// 方法
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  })
}

// 检查小部件类型
const hasWidgetsOfType = (type: WidgetType) => {
  return widgets.value.some((widget) => widget.type === type)
}

// 获取特定类型的小部件
const getWidgetsByType = (type: WidgetType) => {
  return widgets.value.filter((widget) => widget.type === type)
}

// 获取小部件样式
const getWidgetStyle = (widget: Widget) => {
  const { w, h } = widget.position || { w: 2, h: 1 }

  return {
    gridColumn: `span ${Math.min(w || 2, 6)}`, // 最大6列
    gridRow: `span ${Math.min(h || 1, 4)}`, // 最大4行
    transition: 'grid-column 0.3s ease, grid-row 0.3s ease'
  }
}

// 判断是否显示默认布局
const showDefaultLayout = computed(() => {
  return widgets.value.length === 0 && !currentDashboard.value
})

// 创建新看板
const createNewDashboard = async () => {
  try {
    const dashboard = await window.api.dashboards.createDashboard({
      name: '新建看板',
      description: '新建的数据看板',
      layout: 'grid'
    })

    if (dashboard) {
      dashboards.value.push(dashboard)
      selectedDashboard.value = dashboard.id
      await loadDashboard(dashboard.id)
    }
  } catch (error) {
    console.error('Failed to create dashboard:', error)
  }
}

// 删除看板
const deleteDashboard = async () => {
  if (!currentDashboard.value) return

  try {
    // 1. 显示确认对话框
    await ElMessageBox.confirm(
      `确定要删除看板"${currentDashboard.value.name}"吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 2. 设置加载状态
    deletingDashboard.value = true

    // 3. 调用API删除看板
    await window.api.dashboards.deleteDashboard(currentDashboard.value.id)

    // 4. 更新本地状态
    const index = dashboards.value.findIndex((d) => d.id === currentDashboard.value!.id)
    if (index !== -1) {
      dashboards.value.splice(index, 1)
    }

    // 5. 重置选择或选择下一个看板
    if (dashboards.value.length > 0) {
      selectedDashboard.value = dashboards.value[0].id
      await loadDashboard(dashboards.value[0].id)
    } else {
      currentDashboard.value = null
      selectedDashboard.value = ''
      widgets.value = []
    }

    // 6. 显示成功消息
    MessageService.success('看板删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete dashboard:', error)
      MessageService.error('删除看板失败')
    }
  } finally {
    deletingDashboard.value = false
  }
}

// 添加小部件
const addWidgets = () => {
  if (!currentDashboard.value) {
    MessageService.warning('请先选择或创建一个看板')
    return
  }

  configDialogMode.value = 'widget'
  editingWidget.value = null
  showConfigDialog.value = true
}

// 配置看板
const configureDashboard = () => {
  configDialogMode.value = 'dashboard'
  editingDashboard.value = currentDashboard.value
  showConfigDialog.value = true
}

// 导出看板（功能已移除）
const exportDashboard = () => {
  // 功能已移除，按钮已禁用
  MessageService.info('导出功能已移除')
}

// 获取ElementPlus的图标组件
const ElSelect = defineAsyncComponent(() => import('element-plus').then((mod) => mod.ElSelect))
const ElOption = defineAsyncComponent(() => import('element-plus').then((mod) => mod.ElOption))
</script>

<style scoped lang="scss">
.dashboards-view {
  height: 100%;
  display: flex;
  flex-direction: column;

  .view-header {
    margin-bottom: 24px;

    h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: var(--el-text-color-primary);
    }

    .view-description {
      margin: 0;
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }
  }

  .dashboard-controls {
    margin-bottom: 24px;

    .control-buttons {
      display: flex;
      justify-content: center;
      gap: 8px;
    }
  }

  .dashboard-grid {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;

    .stats-row {
      .stat-card {
        border: 1px solid var(--el-border-color);
        background-color: var(--el-bg-color);

        .stat-content {
          display: flex;
          align-items: center;
          gap: 16px;

          .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;

            .el-icon {
              font-size: 24px;
            }
          }

          .stat-info {
            flex: 1;

            .stat-value {
              font-size: 28px;
              font-weight: 600;
              color: var(--el-text-color-primary);
              line-height: 1;
              margin-bottom: 4px;
            }

            .stat-label {
              font-size: 13px;
              color: var(--el-text-color-secondary);
            }
          }

          .stat-trend {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 500;
          }
        }
      }
    }

    .global-loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      gap: 16px;

      p {
        color: var(--el-text-color-secondary);
        font-size: 14px;
      }
    }

    .dashboard-empty,
    .widgets-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--el-bg-color-overlay);
      border: 1px dashed var(--el-border-color);
      border-radius: 8px;
      min-height: 400px;
    }

    .widgets-container {
      flex: 1;
      display: flex;
      flex-direction: column;

      .widgets-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        grid-auto-rows: minmax(200px, auto);
        gap: 16px;
        padding: 8px;

        .widget-item {
          border-radius: 8px;
          overflow: hidden;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
          position: relative;
          cursor: move;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

            .widget-controls {
              opacity: 1;
            }
          }

          .widget-controls {
            position: absolute;
            top: 8px;
            right: 8px;
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.2s ease;
            z-index: 10;

            .control-btn {
              background-color: var(--el-bg-color);
              border: 1px solid var(--el-border-color);
              border-radius: 4px;
              padding: 4px;

              &:hover {
                background-color: var(--el-color-primary);
                color: white;
                border-color: var(--el-color-primary);
              }

              &.danger:hover {
                background-color: var(--el-color-danger);
                border-color: var(--el-color-danger);
              }
            }
          }

          // 拖拽状态样式
          &.widget-ghost {
            opacity: 0.4;
            background: var(--el-color-primary-light-9);
            border: 2px dashed var(--el-color-primary);
            transform: scale(0.95);
          }

          &.widget-chosen {
            transform: scale(1.03) translateY(-4px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
            z-index: 1000;
            border-color: var(--el-color-primary);
          }

          &.widget-drag {
            transform: rotate(3deg) scale(1.02);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
            opacity: 0.85;
            cursor: grabbing !important;
          }
        }

        .trend-chart-placeholder,
        .entity-table-placeholder,
        .custom-widget-placeholder {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: var(--el-bg-color-overlay);
          border: 1px dashed var(--el-border-color);
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          color: var(--el-text-color-secondary);

          .el-icon {
            margin-bottom: 12px;
          }

          p {
            margin: 8px 0;
            font-size: 14px;
            font-weight: 500;
          }

          small {
            font-size: 12px;
            color: var(--el-text-color-placeholder);
          }
        }
      }
    }
  }

  .default-dashboard-layout {
    .stats-row {
      .stat-card {
        border: 1px solid var(--el-border-color);
        background-color: var(--el-bg-color);

        .stat-content {
          display: flex;
          align-items: center;
          gap: 16px;

          .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;

            .el-icon {
              font-size: 24px;
            }
          }

          .stat-info {
            flex: 1;

            .stat-value {
              font-size: 28px;
              font-weight: 600;
              color: var(--el-text-color-primary);
              line-height: 1;
              margin-bottom: 4px;
            }

            .stat-label {
              font-size: 13px;
              color: var(--el-text-color-secondary);
            }
          }

          .stat-trend {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 500;
          }
        }
      }
    }
  }

  .charts-row,
  .tables-row {
    flex: 1;
    min-height: 300px;

    .chart-card,
    .table-card {
      height: 100%;
      border: 1px solid var(--el-border-color);
      background-color: var(--el-bg-color);
      display: flex;
      flex-direction: column;

      :deep(.el-card__header) {
        border-bottom: 1px solid var(--el-border-color);
        padding: 12px 16px;
        background-color: var(--el-bg-color-overlay);
      }

      .chart-header,
      .table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        h3 {
          margin: 0;
          font-size: 16px;
          color: var(--el-text-color-primary);
        }
      }

      .chart-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;

        .chart-placeholder {
          text-align: center;
          color: var(--el-text-color-secondary);

          p {
            margin: 8px 0 0 0;
            font-size: 14px;
          }
        }
      }

      :deep(.el-table) {
        background-color: transparent;

        .el-table__header {
          background-color: var(--el-bg-color-overlay);
        }
      }
    }
  }
}
</style>
