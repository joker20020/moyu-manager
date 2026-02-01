<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    width="80%"
    :before-close="handleClose"
    :destroy-on-close="true"
    class="dashboard-config-dialog"
    @opened="handleDialogOpened"
  >
    <div class="config-container">
      <!-- 看板基本信息配置 -->
      <div v-if="mode === 'dashboard'" class="config-section">
        <h3>看板配置</h3>
        <el-form :model="dashboardConfig" label-width="120px" :rules="formRules" ref="formRef">
          <el-form-item label="看板名称" prop="name">
            <el-input
              v-model="dashboardConfig.name"
              placeholder="输入看板名称"
              maxlength="50"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="描述">
            <el-input
              v-model="dashboardConfig.description"
              type="textarea"
              placeholder="输入看板描述"
              :rows="2"
            />
          </el-form-item>
          <!-- <el-form-item label="布局方式">
            <el-select v-model="dashboardConfig.layout" style="width: 200px">
              <el-option label="网格布局" value="grid" />
              <el-option label="自由布局" value="free" />
            </el-select>
          </el-form-item> -->
        </el-form>
      </div>

      <!-- 小部件配置 -->
      <div v-if="mode === 'widget'" class="config-section">
        <h3>小部件配置</h3>

        <!-- 小部件类型选择 -->
        <div v-if="!selectingType" class="widget-type-selection">
          <h4>选择小部件类型</h4>
          <el-row :gutter="16">
            <el-col v-for="widgetType in availableWidgetTypes" :key="widgetType.type" :span="6">
              <div
                class="widget-type-card"
                :class="{ selected: selectedWidgetType === widgetType.type }"
                @click="selectWidgetType(widgetType.type)"
              >
                <div class="widget-icon">
                  <el-icon :size="32">
                    <component :is="widgetType.icon" />
                  </el-icon>
                </div>
                <div class="widget-info">
                  <div class="widget-name">{{ widgetType.name }}</div>
                  <div class="widget-description">{{ widgetType.description }}</div>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 小部件具体配置 -->
        <div v-else class="widget-specific-config">
          <el-button type="text" @click="backToTypeSelection" class="back-button">
            <el-icon><ArrowLeft /></el-icon>
            返回选择类型
          </el-button>

          <el-form :model="widgetConfig" label-width="120px" :rules="formRules" ref="formRef">
            <el-form-item label="标题" required prop="title">
              <el-input
                v-model="widgetConfig.title"
                placeholder="输入小部件标题"
                maxlength="50"
                show-word-limit
              />
            </el-form-item>

            <!-- 实体类型选择 -->
            <el-form-item label="数据源" prop="entityType">
              <el-select
                v-model="widgetConfig.entityType"
                style="width: 200px"
                placeholder="选择实体类型"
              >
                <el-option label="全部实体" value="all" />
                <el-option
                  v-for="entityType in entityTypes"
                  :key="entityType.id"
                  :label="entityType.name"
                  :value="entityType.id"
                />
              </el-select>
            </el-form-item>

            <!-- 根据小部件类型显示不同配置 -->
            <template v-if="selectedWidgetType === WidgetType.STATISTICS">
              <el-form-item label="统计指标" prop="metrics">
                <el-checkbox-group v-model="widgetConfig.metrics">
                  <el-checkbox label="total-entities">总实体数</el-checkbox>
                  <el-checkbox label="by-type">按类型</el-checkbox>
                  <el-checkbox label="recent-activity">最近活动</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </template>

            <template v-if="selectedWidgetType === WidgetType.RECENT_ENTITIES">
              <el-form-item label="显示数量" prop="limit">
                <el-input-number
                  v-model="widgetConfig.limit"
                  :min="1"
                  :max="50"
                  controls-position="right"
                />
                <span class="form-tip">1-50条记录</span>
              </el-form-item>
              <el-form-item label="排序字段">
                <el-select v-model="widgetConfig.sortBy" style="width: 150px">
                  <el-option label="创建时间" value="createdAt" />
                  <el-option label="更新时间" value="updatedAt" />
                  <el-option label="名称" value="name" />
                </el-select>
              </el-form-item>
              <el-form-item label="排序方式">
                <el-radio-group v-model="widgetConfig.sortOrder">
                  <el-radio label="desc">降序</el-radio>
                  <el-radio label="asc">升序</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="显示列">
                <el-checkbox-group v-model="widgetConfig.showColumns">
                  <el-checkbox label="name">名称</el-checkbox>
                  <el-checkbox label="type">类型</el-checkbox>
                  <el-checkbox label="createdAt">创建时间</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </template>

            <template v-if="selectedWidgetType === WidgetType.ENTITY_DISTRIBUTION">
              <el-form-item label="分布字段" prop="distributionField">
                <el-input
                  v-model="widgetConfig.distributionField"
                  placeholder="输入分布字段名，如：category, status, priority"
                  style="width: 200px"
                />
              </el-form-item>
              <el-form-item label="图表类型">
                <el-select v-model="widgetConfig.chartType" style="width: 150px">
                  <el-option label="饼图" value="pie" />
                  <el-option label="柱状图" value="bar" />
                  <el-option label="环图" value="doughnut" />
                </el-select>
              </el-form-item>
              <el-form-item label="显示百分比">
                <el-switch v-model="widgetConfig.showPercentages" />
              </el-form-item>
            </template>

            <template v-if="selectedWidgetType === WidgetType.TREND_CHART">
              <el-form-item label="图表类型">
                <el-select v-model="widgetConfig.chartType" style="width: 150px">
                  <el-option label="折线图" value="line" />
                  <el-option label="面积图" value="area" />
                  <el-option label="柱状图" value="bar" />
                </el-select>
              </el-form-item>
            </template>

            <template v-if="selectedWidgetType === WidgetType.ENTITY_TABLE">
              <el-form-item label="显示列" prop="columns">
                <el-checkbox-group v-model="widgetConfig.columns">
                  <el-checkbox
                    v-for="column in entityTableColumnOptions"
                    :key="column.value"
                    :label="column.value"
                  >
                    {{ column.label }}
                  </el-checkbox>
                </el-checkbox-group>
              </el-form-item>
              <el-form-item label="每页数量" prop="pageSize">
                <el-input-number
                  v-model="widgetConfig.pageSize"
                  :min="5"
                  :max="100"
                  controls-position="right"
                />
                <span class="form-tip">5-100条/页</span>
              </el-form-item>
              <el-form-item label="启用排序">
                <el-switch v-model="widgetConfig.enableSorting" />
              </el-form-item>
              <el-form-item label="启用过滤">
                <el-switch v-model="widgetConfig.enableFiltering" />
              </el-form-item>
            </template>

            <!-- 自动刷新配置 -->
            <el-form-item label="自动刷新间隔">
              <el-select
                v-model="widgetConfig.refreshInterval"
                style="width: 150px"
                placeholder="选择刷新间隔"
              >
                <el-option label="关闭" :value="0" />
                <el-option label="30秒" :value="30" />
                <el-option label="1分钟" :value="60" />
                <el-option label="5分钟" :value="300" />
                <el-option label="10分钟" :value="600" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="confirmLoading">
          {{ mode === 'dashboard' ? '保存看板' : '添加小部件' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, toRaw } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { debounce } from 'lodash'
import MessageService from '../utils/messageService'
import { WidgetType } from '../../../shared/types/dashboards'
import { ArrowLeft, DataLine, TrendCharts, List, Tools, DataBoard } from '@element-plus/icons-vue'
import { EntityType, FIXED_FIELDS } from '../../../shared/types/entities'

// 获取实体类型的所有可用字段（固定字段 + 自定义字段）
function getAvailableFieldsForEntityType(
  entityTypes: EntityType[],
  entityTypeId: string
): string[] {
  if (entityTypeId === 'all') {
    // 全部实体类型：只返回固定字段（排除 _id）
    return FIXED_FIELDS.filter((field) => field.id !== '_id').map((field) => field.id)
  }

  const entityType = entityTypes.find((type) => type.id === entityTypeId)
  if (!entityType) {
    return []
  }

  // 固定字段（排除 _id）
  const fixedFieldIds = FIXED_FIELDS.filter((field) => field.id !== '_id').map((field) => field.id)
  // 自定义字段
  const customFieldIds = entityType.fields.map((field) => field.id)

  return [...fixedFieldIds, ...customFieldIds]
}

// 获取字段的显示标签
function getFieldLabel(entityTypes: EntityType[], entityTypeId: string, fieldId: string): string {
  // 先查找固定字段
  const fixedField = FIXED_FIELDS.find((field) => field.id === fieldId)
  if (fixedField) {
    return fixedField.name
  }

  // 查找当前选中实体类型的自定义字段
  if (entityTypeId && entityTypeId !== 'all') {
    const entityType = entityTypes.find((type) => type.id === entityTypeId)
    if (entityType) {
      const customField = entityType.fields.find((field) => field.id === fieldId)
      if (customField) {
        return customField.name
      }
    }
  }

  // 后备：使用字段ID
  return fieldId
}

interface Props {
  modelValue: boolean
  mode: 'dashboard' | 'widget'
  entityTypes: EntityType[]
  editingDashboard?: any
  editingWidget?: any
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', data: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const title = computed(() => {
  if (props.mode === 'dashboard') {
    return props.editingDashboard ? '编辑看板' : '新建看板'
  } else {
    return props.editingWidget ? '编辑小部件' : '添加小部件'
  }
})

const confirmLoading = ref(false)
const formRef = ref<FormInstance>()

// 看板配置
const dashboardConfig = ref({
  name: '',
  description: '',
  layout: 'grid'
})

// 小部件配置
const widgetConfig = ref<any>({
  title: '',
  entityType: 'all',
  refreshInterval: 0
})

// 实体表格可用的列选项（基于选择的实体类型）
const entityTableColumnOptions = computed(() => {
  const entityTypeId = widgetConfig.value.entityType
  const availableFields = getAvailableFieldsForEntityType(props.entityTypes, entityTypeId)

  // 转换为checkbox选项格式
  return availableFields.map((fieldId) => ({
    value: fieldId,
    label: getFieldLabel(props.entityTypes, entityTypeId, fieldId)
  }))
})

// 智能默认列选择（当实体类型改变时自动选择合适列）
const getDefaultColumnsForEntityType = (entityTypeId: string): string[] => {
  if (entityTypeId === 'all') {
    return ['name', '_type', 'createdAt'] // 全部实体类型显示基本列
  }

  const entityType = props.entityTypes.find((type) => type.id === entityTypeId)
  if (!entityType) {
    return ['name', '_type', 'createdAt']
  }

  // 默认包含固定字段：name, _type, createdAt
  const defaultColumns = ['name', '_type', 'createdAt']

  // 根据实体类型添加有意义的自定义字段
  // 例如：任务类型包含 status, priority；联系人类型包含 email 等
  // 这里简单添加前两个自定义字段（如果有）
  const customFields = entityType.fields.slice(0, 2).map((field) => field.id)
  return [...defaultColumns, ...customFields]
}

// 监听实体类型变化，自动更新实体表格的列选择
watch(
  () => widgetConfig.value.entityType,
  (newEntityTypeId, oldEntityTypeId) => {
    // 仅当小部件类型是实体表格时处理
    if (selectedWidgetType.value !== WidgetType.ENTITY_TABLE) {
      return
    }

    // 跳过编辑模式下初始触发（编辑watch会设置正确的列）
    if (oldEntityTypeId === undefined && props.editingWidget) {
      return
    }

    // 检查是否有现有列配置
    const hasExistingColumns = widgetConfig.value.columns && widgetConfig.value.columns.length > 0

    if (!hasExistingColumns || oldEntityTypeId === undefined) {
      // 设置智能默认列
      widgetConfig.value.columns = getDefaultColumnsForEntityType(newEntityTypeId)
    } else {
      // 有现有列配置，过滤掉新实体类型不存在的列
      const availableFields = getAvailableFieldsForEntityType(props.entityTypes, newEntityTypeId)
      widgetConfig.value.columns = widgetConfig.value.columns.filter((col: string) =>
        availableFields.includes(col)
      )
      // 如果过滤后没有列，使用默认列
      if (widgetConfig.value.columns.length === 0) {
        widgetConfig.value.columns = getDefaultColumnsForEntityType(newEntityTypeId)
      }
    }
  }
)

const selectedWidgetType = ref<string>('')
const selectingType = ref(false)

// 表单验证规则
const formRules = computed<FormRules>(() => {
  if (props.mode === 'dashboard') {
    return {
      name: [
        { required: true, message: '请输入看板名称', trigger: 'blur' },
        { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
      ]
    }
  } else {
    // Widget验证规则
    const rules: FormRules = {
      title: [
        { required: true, message: '请输入小部件标题', trigger: 'blur' },
        { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
      ],
      entityType: [{ required: true, message: '请选择数据源', trigger: 'change' }]
    }

    // 根据widget类型添加特定验证
    if (selectedWidgetType.value === WidgetType.STATISTICS) {
      rules.metrics = [
        {
          type: 'array',
          required: true,
          min: 1,
          message: '请至少选择一个统计指标',
          trigger: 'change'
        }
      ]
    }

    if (selectedWidgetType.value === WidgetType.RECENT_ENTITIES) {
      rules.limit = [
        { type: 'number', required: true, message: '请输入显示数量', trigger: 'blur' },
        { type: 'number', min: 1, max: 50, message: '数量在 1 到 50 之间', trigger: 'blur' }
      ]
    }

    if (selectedWidgetType.value === WidgetType.ENTITY_DISTRIBUTION) {
      rules.distributionField = [{ required: true, message: '请选择分布字段', trigger: 'change' }]
    }

    if (selectedWidgetType.value === WidgetType.TREND_CHART) {
      // 趋势图表现在只显示数量变化，不需要指标字段和时间范围配置
    }

    if (selectedWidgetType.value === WidgetType.ENTITY_TABLE) {
      rules.columns = [
        { type: 'array', required: true, min: 1, message: '请至少选择一列', trigger: 'change' }
      ]
      rules.pageSize = [
        { type: 'number', required: true, message: '请输入每页数量', trigger: 'blur' },
        { type: 'number', min: 5, max: 100, message: '数量在 5 到 100 之间', trigger: 'blur' }
      ]
    }

    return rules
  }
})

// 可用的小部件类型
const availableWidgetTypes = [
  {
    type: WidgetType.STATISTICS,
    name: '统计数据',
    description: '显示实体统计信息',
    icon: DataLine
  },
  {
    type: WidgetType.RECENT_ENTITIES,
    name: '最近实体',
    description: '显示最近创建的实体',
    icon: List
  },
  {
    type: WidgetType.ENTITY_DISTRIBUTION,
    name: '实体分布',
    description: '显示实体分布图表',
    icon: DataBoard
  },
  {
    type: WidgetType.TREND_CHART,
    name: '趋势图表',
    description: '显示数据趋势',
    icon: TrendCharts
  },
  {
    type: WidgetType.ENTITY_TABLE,
    name: '实体表格',
    description: '显示实体列表',
    icon: Tools
  }
]

// 选择小部件类型
const selectWidgetType = (type: string) => {
  selectedWidgetType.value = type
  selectingType.value = true // 关键：设置为true以显示配置界面

  // 根据类型设置默认配置
  switch (type) {
    case WidgetType.STATISTICS:
      widgetConfig.value = {
        ...widgetConfig.value,
        metrics: ['total-entities']
      }
      break
    case WidgetType.RECENT_ENTITIES:
      widgetConfig.value = {
        ...widgetConfig.value,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        showColumns: ['name', 'type', 'createdAt']
      }
      break
    case WidgetType.ENTITY_DISTRIBUTION:
      widgetConfig.value = {
        ...widgetConfig.value,
        distributionField: 'category',
        chartType: 'pie',
        showPercentages: true
      }
      break
    case WidgetType.TREND_CHART:
      widgetConfig.value = {
        ...widgetConfig.value,
        chartType: 'line'
      }
      break
    case WidgetType.ENTITY_TABLE:
      widgetConfig.value = {
        ...widgetConfig.value,
        columns: getDefaultColumnsForEntityType(widgetConfig.value.entityType),
        pageSize: 20,
        enableSorting: true,
        enableFiltering: true
      }
      break
  }
}

// 返回类型选择
const backToTypeSelection = async () => {
  // 等待下一个tick以避免ResizeObserver错误
  await nextTick()
  selectedWidgetType.value = ''
  selectingType.value = false

  // 清除表单验证
  if (formRef.value) {
    formRef.value.clearValidate()
  }
}

// 对话框打开后的回调
const handleDialogOpened = () => {
  // 如果是编辑模式，确保editingWidget设置为true
  if (props.mode === 'widget' && props.editingWidget) {
    selectedWidgetType.value = props.editingWidget.type
    selectingType.value = true
  } else if (props.mode === 'widget') {
    // 新建widget，显示类型选择
    selectedWidgetType.value = ''
    selectingType.value = false
  }
}

// 防抖保存函数
const debouncedSave = debounce(async () => {
  confirmLoading.value = true

  try {
    // 表单验证
    if (formRef.value) {
      const valid = await formRef.value.validate().catch(() => false)
      if (!valid) {
        return
      }
    }

    if (props.mode === 'dashboard') {
      if (!dashboardConfig.value.name.trim()) {
        MessageService.error('请输入看板名称')
        return
      }

      emit('confirm', {
        type: 'dashboard',
        data: { ...toRaw(dashboardConfig.value) }
      })

      MessageService.success('看板配置保存成功')
    } else {
      if (!selectedWidgetType.value) {
        MessageService.error('请选择小部件类型')
        return
      }

      if (!widgetConfig.value.title.trim()) {
        MessageService.error('请输入小部件标题')
        return
      }

      emit('confirm', {
        type: 'widget',
        data: {
          type: selectedWidgetType.value,
          config: { ...toRaw(widgetConfig.value) }
        }
      })

      MessageService.success('小部件添加成功')
    }

    handleClose()
  } catch (error) {
    MessageService.error('操作失败')
  } finally {
    confirmLoading.value = false
  }
}, 300)

// 确认操作
const handleConfirm = () => {
  debouncedSave()
}

// 重置表单
const resetForm = () => {
  dashboardConfig.value = {
    name: '',
    description: '',
    layout: 'grid'
  }

  widgetConfig.value = {
    title: '',
    entityType: 'all',
    refreshInterval: 0
  }

  selectedWidgetType.value = ''
  selectingType.value = false
  confirmLoading.value = false

  // 清除表单验证
  if (formRef.value) {
    formRef.value.clearValidate()
  }
}

// 关闭对话框
const handleClose = async () => {
  // 等待下一个tick以避免ResizeObserver错误
  await nextTick()
  dialogVisible.value = false
  resetForm()
}

// 监听编辑数据
watch(
  () => props.editingWidget,
  async (data) => {
    if (data) {
      // 等待DOM更新
      await nextTick()
      selectingType.value = true
      selectedWidgetType.value = data.type
      // 合并配置，确保有默认值
      const config = { ...data.config }
      // 为最近实体小部件添加默认的showColumns
      if (data.type === WidgetType.RECENT_ENTITIES && !config.showColumns) {
        config.showColumns = ['name', 'type', 'createdAt']
      }
      // 实体表格小部件：将旧版'type'列转换为'_type'，并确保列有效性
      if (data.type === WidgetType.ENTITY_TABLE && config.columns) {
        // 转换 'type' -> '_type'
        config.columns = config.columns.map((col: string) => (col === 'type' ? '_type' : col))
        // 可选：过滤掉不存在的字段（但编辑时应该已经有效）
      }
      widgetConfig.value = config
    }
  },
  { immediate: true, flush: 'post' }
)
</script>

<style scoped lang="scss">
.dashboard-config-dialog {
  .config-container {
    min-height: 400px;
  }

  .config-section {
    margin-bottom: 24px;

    h3 {
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
    }
  }

  .widget-type-selection {
    h4 {
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
    }

    .widget-type-card {
      display: flex;
      align-items: center;
      padding: 16px;
      border: 2px solid var(--el-border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      height: 100px;

      &:hover {
        border-color: var(--el-color-primary);
        background-color: var(--el-color-primary-light-9);
      }

      &.selected {
        border-color: var(--el-color-primary);
        background-color: var(--el-color-primary-light-8);
      }

      .widget-icon {
        margin-right: 12px;
        color: var(--el-color-primary);
      }

      .widget-info {
        flex: 1;

        .widget-name {
          font-weight: 600;
          color: var(--el-text-color-primary);
          margin-bottom: 4px;
        }

        .widget-description {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }

  .widget-specific-config {
    .back-button {
      margin-bottom: 16px;
      color: var(--el-text-color-secondary);
    }

    .form-tip {
      margin-left: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

:deep(.el-dialog__body) {
  padding: 24px;
}
</style>
