<template>
  <div class="entities-view">
    <div class="view-header">
      <h2>实体管理</h2>
      <p class="view-description">管理您的实体类型和数据</p>
    </div>

    <div class="entity-stats">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-statistic :title="'实体类型'" :value="entityTypeCount">
            <template #prefix>
              <el-icon><Folder /></el-icon>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic :title="'总实体数'" :value="totalEntityCount">
            <template #prefix>
              <el-icon><Document /></el-icon>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic :title="'今日新增'" :value="todayEntityCount">
            <template #prefix>
              <el-icon><TrendCharts /></el-icon>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic :title="'选中数量'" :value="selectedEntities.length">
            <template #prefix>
              <el-icon><Select /></el-icon>
            </template>
          </el-statistic>
        </el-col>
      </el-row>
    </div>

    <div class="view-content">
      <el-tabs v-model="activeTab" class="entity-tabs">
        <!-- 实体列表标签页 -->
        <el-tab-pane label="实体列表" name="list">
          <div class="entity-list-container">
            <!-- 工具栏 -->
            <div class="list-toolbar">
              <div class="toolbar-left">
                <el-button type="primary" size="small" @click="openCreateDialog">
                  <el-icon><Plus /></el-icon>
                  新建实体
                </el-button>
                <el-button
                  size="small"
                  :disabled="selectedEntities.length === 0"
                  @click="handleBatchDelete"
                >
                  <el-icon><Delete /></el-icon>
                  批量删除
                </el-button>
                <el-button size="small" @click="handleExport">
                  <el-icon><Download /></el-icon>
                  导出
                </el-button>
                <el-button size="small" @click="handleImport">
                  <el-icon><Upload /></el-icon>
                  导入
                </el-button>
              </div>
              <div class="toolbar-right">
                <el-select
                  v-model="selectedTypeFilter"
                  placeholder="筛选类型"
                  size="small"
                  clearable
                  style="width: 150px; margin-right: 10px"
                >
                  <el-option label="全部类型" value="" />
                  <el-option
                    v-for="type in entityTypes"
                    :key="type.id"
                    :label="type.name"
                    :value="type.id"
                  />
                </el-select>
                <el-input
                  v-model="searchQuery"
                  placeholder="搜索实体..."
                  size="small"
                  style="width: 200px; margin-right: 10px"
                  clearable
                  @input="handleSearch"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
                <el-button size="small" @click="refreshEntities">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
              </div>
            </div>

            <!-- 实体表格 -->
            <div class="list-table">
              <el-table
                ref="entityTable"
                v-loading="loading.entities"
                :data="filteredEntities"
                style="width: 100%"
                row-key="_id"
                table-layout="auto"
                @selection-change="handleSelectionChange"
              >
                <el-table-column type="selection" width="55" />
                <el-table-column prop="name" label="名称" width="180" sortable>
                  <template #default="{ row }">
                    <div class="entity-name-cell">
                      <el-icon v-if="getEntityTypeIcon(row._type)" class="entity-icon">
                        <component :is="getEntityTypeIcon(row._type)" />
                      </el-icon>
                      <span>{{ row.name }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="_type" label="类型" width="120" sortable>
                  <template #default="{ row }">
                    <el-tag size="small" :color="getEntityTypeColor(row._type)">
                      {{ getEntityTypeName(row._type) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="createdAt" label="创建时间" width="160" sortable>
                  <template #default="{ row }">
                    {{ formatDate(row.createdAt) }}
                  </template>
                </el-table-column>
                <el-table-column prop="updatedAt" label="更新时间" width="160" sortable>
                  <template #default="{ row }">
                    {{ formatDate(row.updatedAt) }}
                  </template>
                </el-table-column>
                <el-table-column label="操作">
                  <template #default="{ row }">
                    <el-button size="small" type="text" @click="openEditDialog(row)">
                      编辑
                    </el-button>
                    <el-button size="small" type="text" @click="openDetailDialog(row)">
                      详情
                    </el-button>
                    <el-button
                      size="small"
                      type="text"
                      style="color: var(--el-color-danger)"
                      @click="deleteEntity(row._id)"
                    >
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>

              <!-- 分页 -->
              <div class="pagination-container" v-if="totalCount > 0">
                <el-pagination
                  v-model:current-page="currentPage"
                  v-model:page-size="pageSize"
                  :page-sizes="[10, 20, 50, 100]"
                  :total="totalCount"
                  layout="total, sizes, prev, pager, next, jumper"
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
                />
              </div>

              <!-- 空状态 -->
              <div v-if="!loading.entities && filteredEntities.length === 0" class="empty-state">
                <el-empty description="暂无实体数据">
                  <el-button type="primary" @click="openCreateDialog">创建实体</el-button>
                </el-empty>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 实体类型管理标签页 -->
        <el-tab-pane label="实体类型" name="types">
          <div class="entity-types-container">
            <div class="types-toolbar">
              <el-button type="primary" size="small" @click="openCreateTypeDialog">
                <el-icon><Plus /></el-icon>
                新建类型
              </el-button>
            </div>

            <div class="types-grid">
              <el-row :gutter="16">
                <el-col :span="8" v-for="type in entityTypes" :key="type.id">
                  <el-card class="type-card" shadow="hover">
                    <div class="type-header">
                      <div class="type-icon" :style="{ backgroundColor: type.color + '20' }">
                        <el-icon :style="{ color: type.color }">
                          <component :is="type.icon || 'Folder'" />
                        </el-icon>
                      </div>
                      <div class="type-title">
                        <h4>{{ type.name }}</h4>
                        <div class="type-meta">
                          <span class="type-count">
                            {{ getEntityCountByType(type.id) }} 个实体
                          </span>
                          <el-tag size="small">{{ type.fields.length }} 字段</el-tag>
                        </div>
                      </div>
                    </div>

                    <div class="type-description">
                      {{ type.description || '暂无描述' }}
                    </div>

                    <div class="type-actions">
                      <el-button type="text" size="small" @click="openEditTypeDialog(type)">
                        编辑
                      </el-button>
                      <el-button
                        type="text"
                        size="small"
                        style="color: var(--el-color-danger)"
                        @click="deleteEntityType(type.id)"
                      >
                        删除
                      </el-button>
                    </div>
                  </el-card>
                </el-col>
              </el-row>

              <!-- 空状态 -->
              <div v-if="!loading.types && entityTypes.length === 0" class="empty-state">
                <el-empty description="暂无实体类型">
                  <el-button type="primary" @click="openCreateTypeDialog">创建类型</el-button>
                </el-empty>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 实体对话框 -->
    <EntityDialog
      :visible="entityDialogVisible"
      :entity-types="entityTypes"
      :entity="selectedEntity"
      :is-edit="isEditMode"
      @confirm="handleEntityConfirm"
      @cancel="handleEntityCancel"
    />

    <!-- 实体类型对话框 (完整版，支持自定义字段配置) -->
    <el-dialog
      v-model="typeDialogVisible"
      :title="isEditTypeMode ? '编辑实体类型' : '新建实体类型'"
      width="800px"
      :before-close="handleTypeDialogClose"
      :close-on-click-modal="false"
    >
      <el-form
        v-if="typeDialogVisible"
        ref="typeFormRef"
        :model="typeForm"
        :rules="typeFormRules"
        label-width="100px"
        @submit.prevent="handleTypeConfirm"
      >
        <!-- 基本信息 -->
        <div class="form-section">
          <h4 class="section-title">基本信息</h4>
          <el-form-item label="类型名称" prop="name" required>
            <el-input v-model="typeForm.name" placeholder="请输入类型名称" />
          </el-form-item>
          <el-form-item label="描述" prop="description">
            <el-input
              v-model="typeForm.description"
              type="textarea"
              :rows="2"
              placeholder="请输入类型描述"
            />
          </el-form-item>
          <el-form-item label="图标" prop="icon">
            <el-select v-model="typeForm.icon" placeholder="选择图标" style="width: 100%">
              <el-option label="文件夹" value="Folder" />
              <el-option label="任务" value="List" />
              <el-option label="联系人" value="User" />
              <el-option label="项目" value="DataAnalysis" />
              <el-option label="笔记" value="Document" />
              <el-option label="设置" value="Setting" />
              <el-option label="标签" value="CollectionTag" />
              <el-option label="统计" value="TrendCharts" />
              <el-option label="数据" value="DataBoard" />
            </el-select>
          </el-form-item>
          <el-form-item label="颜色" prop="color">
            <el-color-picker v-model="typeForm.color" />
          </el-form-item>
        </div>

        <!-- 自定义字段配置 -->
        <div class="form-section">
          <div class="section-header">
            <h4 class="section-title">自定义字段</h4>
            <el-button type="primary" size="small" @click="addCustomField" :icon="Plus">
              添加字段
            </el-button>
          </div>

          <div v-if="typeForm.fields.length === 0" class="empty-fields">
            <el-empty description="暂无自定义字段" :image-size="80">
              <el-button type="primary" size="small" @click="addCustomField">
                添加第一个字段
              </el-button>
            </el-empty>
          </div>

          <div v-else class="fields-list">
            <div v-for="(field, index) in typeForm.fields" :key="field.key" class="field-item">
              <el-card class="field-card">
                <div class="field-header">
                  <span class="field-index">{{ index + 1 }}</span>
                  <el-button
                    type="danger"
                    size="small"
                    text
                    @click="removeCustomField(index)"
                    :icon="Delete"
                  >
                    删除
                  </el-button>
                </div>

                <div class="field-content">
                  <el-row :gutter="16">
                    <el-col :span="12">
                      <el-form-item
                        :label="'字段名称'"
                        :prop="'fields.' + index + '.name'"
                        :rules="fieldRules.name"
                        required
                      >
                        <el-input v-model="field.name" placeholder="字段名称" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item
                        :label="'字段ID'"
                        :prop="'fields.' + index + '.id'"
                        :rules="fieldRules.id"
                        required
                      >
                        <el-input v-model="field.id" placeholder="字段ID (英文)" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row :gutter="16">
                    <el-col :span="8">
                      <el-form-item
                        :label="'字段类型'"
                        :prop="'fields.' + index + '.type'"
                        :rules="fieldRules.type"
                        required
                      >
                        <el-select
                          v-model="field.type"
                          placeholder="选择字段类型"
                          @change="onFieldTypeChange(field, index)"
                          style="width: 100%"
                        >
                          <el-option label="文本" value="text" />
                          <el-option label="数字" value="number" />
                          <el-option label="日期" value="date" />
                          <el-option label="下拉框" value="select" />
                          <el-option label="布尔值" value="boolean" />
                        </el-select>
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item :label="'必填'">
                        <el-switch
                          v-model="field.required"
                          active-text="必填"
                          inactive-text="选填"
                        />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item :label="'默认值'">
                        <template v-if="field.type === 'boolean'">
                          <el-switch
                            v-model="field.defaultValue"
                            active-text="是"
                            inactive-text="否"
                          />
                        </template>
                        <template v-else-if="field.type === 'number'">
                          <el-input-number
                            v-model="field.defaultValue"
                            placeholder="默认数字值"
                            style="width: 100%"
                          />
                        </template>
                        <template v-else-if="field.type === 'date'">
                          <el-date-picker
                            v-model="field.defaultValue"
                            type="date"
                            placeholder="默认日期"
                            format="YYYY-MM-DD"
                            value-format="x"
                            style="width: 100%"
                          />
                        </template>
                        <template v-else-if="field.type === 'select'">
                          <el-input v-model="field.defaultValue" placeholder="默认选项值" />
                        </template>
                        <template v-else>
                          <el-input v-model="field.defaultValue" placeholder="默认文本值" />
                        </template>
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-form-item :label="'字段描述'">
                    <el-input
                      v-model="field.description"
                      type="textarea"
                      :rows="1"
                      placeholder="字段描述（可选）"
                    />
                  </el-form-item>

                  <!-- 下拉框选项配置 -->
                  <el-form-item
                    v-if="field.type === 'select'"
                    :label="'选项配置'"
                    :prop="'fields.' + index + '.options'"
                    :rules="fieldRules.options"
                    required
                  >
                    <div class="options-container">
                      <div
                        v-for="(option, optIndex) in field.options || []"
                        :key="optIndex"
                        class="option-item"
                      >
                        <el-input
                          v-model="(field.options || [])[optIndex]"
                          placeholder="选项内容"
                          style="flex: 1"
                        />
                        <el-button
                          type="danger"
                          size="small"
                          text
                          @click="removeFieldOption(field, optIndex)"
                          :icon="Delete"
                        >
                        </el-button>
                      </div>
                      <el-button
                        type="primary"
                        size="small"
                        text
                        @click="addFieldOption(field)"
                        :icon="Plus"
                      >
                        添加选项
                      </el-button>
                    </div>
                  </el-form-item>
                </div>
              </el-card>
            </div>
          </div>
        </div>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleTypeDialogClose">取消</el-button>
          <el-button type="primary" @click="handleTypeConfirm" :loading="submittingType">
            {{ isEditTypeMode ? '更新' : '创建' }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 实体详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="实体详情" width="700px">
      <div v-if="selectedEntity" class="entity-detail">
        <div class="detail-header">
          <div
            class="detail-icon"
            :style="{ backgroundColor: getEntityTypeColor(selectedEntity._type) + '20' }"
          >
            <el-icon :size="32" :color="getEntityTypeColor(selectedEntity._type)">
              <component :is="getEntityTypeIcon(selectedEntity._type)" />
            </el-icon>
          </div>
          <div class="detail-title">
            <h3>{{ selectedEntity.name }}</h3>
            <div class="detail-meta">
              <el-tag :color="getEntityTypeColor(selectedEntity._type)" size="large">
                {{ getEntityTypeName(selectedEntity._type) }}
              </el-tag>
              <span class="detail-id">ID: {{ selectedEntity._id }}</span>
            </div>
          </div>
        </div>

        <el-divider />

        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="创建时间">
              {{ formatDate(selectedEntity.createdAt, 'full') }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ formatDate(selectedEntity.updatedAt, 'full') }}
            </el-descriptions-item>
          </el-descriptions>

          <h4 style="margin-top: 20px">字段数据</h4>
          <el-table :data="getEntityFieldsData(selectedEntity)" style="width: 100%">
            <el-table-column prop="name" label="字段名称" width="150" />
            <el-table-column prop="value" label="字段值" />
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { storeToRefs } from 'pinia'
import EntityDialog from '../components/EntityDialog.vue'
import type { EntityType, EntityInstance } from '../../../shared/types/entities'
import { FIXED_FIELDS } from '../../../shared/types/entities'
import {
  Folder,
  Document,
  TrendCharts,
  Select,
  Plus,
  Delete,
  Download,
  Upload,
  Search,
  Refresh,
  User,
  List,
  DataAnalysis
} from '@element-plus/icons-vue'
import { TableInstance } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'

// Store
const store = useAppStore()
const { entities, entityTypes, loading, selectedCount } = storeToRefs(store)

// Router
const route = useRoute()
const router = useRouter()

// 响应式状态
const activeTab = ref('list')
const searchQuery = ref('')
const searchedEntities = ref<EntityInstance[]>([])
const searchLoading = ref(false)

// 防抖函数
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

// 搜索函数
const performSearch = async (query: string) => {
  if (!query.trim()) {
    searchedEntities.value = []
    return
  }

  searchLoading.value = true
  try {
    // 调用IPC搜索API
    const results = await window.api.entities.search(query)
    searchedEntities.value = results
  } catch (error) {
    console.error('搜索失败:', error)
    ElMessage.error('搜索失败: ' + (error instanceof Error ? error.message : '未知错误'))
    searchedEntities.value = []
  } finally {
    searchLoading.value = false
  }
}

// 防抖搜索
const debouncedSearch = debounce((query: string) => {
  performSearch(query)
}, 300)

// 监听搜索查询变化
watch(searchQuery, (newQuery) => {
  if (newQuery.trim()) {
    debouncedSearch(newQuery)
  } else {
    searchedEntities.value = []
  }
})
const entityTable = ref<TableInstance>()
const selectedTypeFilter = ref('')
// 监听路由查询参数中的类型筛选
watch(
  () => route.query.type,
  (type) => {
    if (type && typeof type === 'string') {
      selectedTypeFilter.value = type
    } else {
      selectedTypeFilter.value = ''
    }
  },
  { immediate: true }
)
const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)
const selectedEntity = ref<EntityInstance | undefined>(undefined)
const entityDialogVisible = ref(false)
const isEditMode = ref(false)
const typeDialogVisible = ref(false)
const isEditTypeMode = ref(false)
const detailDialogVisible = ref(false)
const selectedEntities = ref<string[]>([])
const typeFormRef = ref<any>() // 表单引用
const submittingType = ref(false) // 提交状态
const typeForm = ref({
  id: '',
  name: '',
  description: '',
  icon: 'Folder',
  color: '#8a6df7',
  fields: [] as CustomField[]
})

// 自定义字段类型
interface CustomField {
  key: string // 用于v-for的key
  id: string // 字段ID
  name: string // 字段名称
  type: 'text' | 'number' | 'date' | 'select' | 'boolean'
  required?: boolean
  defaultValue?: any
  description?: string
  options?: string[] // 下拉框选项
}

// 表单验证规则
const typeFormRules = computed(() => ({
  name: [{ required: true, message: '请输入类型名称', trigger: 'blur' }],
  description: [{ max: 200, message: '描述不能超过200个字符', trigger: 'blur' }],
  icon: [{ required: true, message: '请选择图标', trigger: 'change' }],
  color: [{ required: true, message: '请选择颜色', trigger: 'change' }]
}))

// 字段验证规则
const fieldRules = {
  name: [
    { required: true, message: '请输入字段名称', trigger: 'blur' },
    { max: 50, message: '字段名称不能超过50个字符', trigger: 'blur' }
  ],
  id: [
    { required: true, message: '请输入字段ID', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
      message: '字段ID必须以字母开头，只能包含字母、数字和下划线',
      trigger: 'blur'
    },
    { max: 30, message: '字段ID不能超过30个字符', trigger: 'blur' }
  ],
  type: [{ required: true, message: '请选择字段类型', trigger: 'change' }],
  options: [
    {
      validator: (rule: any, value: any, callback: any) => {
        const fieldIndex = parseInt(rule.field.split('.')[1])
        const field = typeForm.value.fields[fieldIndex]
        if (field?.type === 'select' && (!value || value.length === 0)) {
          callback(new Error('下拉框类型必须添加至少一个选项'))
        } else if (field?.type === 'select' && value.some((opt: string) => !opt.trim())) {
          callback(new Error('选项内容不能为空'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]
}

// 计算属性
const entityTypeCount = computed(() => entityTypes.value.length)
const totalEntityCount = computed(() => entities.value.length)
const todayEntityCount = computed(() => {
  const today = new Date().setHours(0, 0, 0, 0)
  return entities.value.filter((e) => {
    const createDate = new Date(e.createdAt).setHours(0, 0, 0, 0)
    return createDate === today
  }).length
})

const filteredEntities = computed(() => {
  // 选择数据源：如果有搜索查询，使用搜索结果，否则使用全部实体
  const sourceEntities =
    searchQuery.value && searchedEntities.value.length > 0 ? searchedEntities.value : entities.value

  let result = sourceEntities

  // 类型筛选
  if (selectedTypeFilter.value) {
    result = result.filter((e) => e._type === selectedTypeFilter.value)
  }

  // 注意：搜索筛选已在服务器端完成（如果调用了搜索API）
  // 如果搜索查询不为空但searchedEntities为空（例如正在加载），则显示空结果
  // 我们不在此处进行客户端搜索筛选

  // 分页
  totalCount.value = result.length
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return result.slice(start, end)
})

const throttle = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), wait)
    }
  }
}

// 方法
const refreshEntities = throttle(async () => {
  await store.refreshEntities()
  ElMessage.success('数据已刷新')
}, 1000)

const openCreateDialog = () => {
  selectedEntity.value = undefined
  isEditMode.value = false
  entityDialogVisible.value = true
}

const openEditDialog = (entity: EntityInstance) => {
  selectedEntity.value = entity
  isEditMode.value = true
  entityDialogVisible.value = true
}

const openDetailDialog = (entity: EntityInstance) => {
  selectedEntity.value = entity
  detailDialogVisible.value = true
}

const openCreateTypeDialog = () => {
  typeForm.value = {
    id: '',
    name: '',
    description: '',
    icon: 'Folder',
    color: '#8a6df7',
    fields: []
  }
  isEditTypeMode.value = false
  submittingType.value = false
  typeDialogVisible.value = true

  // 重置表单验证状态
  nextTick(() => {
    if (typeFormRef.value) {
      typeFormRef.value.clearValidate()
    }
  })
}

const openEditTypeDialog = (type: EntityType) => {
  typeForm.value = {
    id: type.id,
    name: type.name,
    description: type.description || '',
    icon: type.icon || 'Folder',
    color: type.color || '#8a6df7',
    fields: type.fields.map((field) => ({
      ...field,
      key: Date.now().toString() + Math.random(), // 生成唯一key
      options: field.options ? [...field.options] : undefined
    }))
  }
  isEditTypeMode.value = true
  submittingType.value = false
  typeDialogVisible.value = true

  // 重置表单验证状态
  nextTick(() => {
    if (typeFormRef.value) {
      typeFormRef.value.clearValidate()
    }
  })
}

const handleEntityConfirm = async (entityData: Partial<EntityInstance>) => {
  try {
    if (isEditMode.value && entityData._id) {
      // 更新实体
      await window.api.entities.updateEntity(entityData._id, entityData)
      ElMessage.success('实体更新成功')
    } else {
      // 创建实体
      await window.api.entities.createEntity(entityData)
      ElMessage.success('实体创建成功')
    }

    entityDialogVisible.value = false
    await refreshEntities()
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error('操作失败')
  }
}

const handleEntityCancel = () => {
  entityDialogVisible.value = false
}

const handleTypeConfirm = async () => {
  if (!typeFormRef.value) return

  try {
    // 验证表单
    const valid = await typeFormRef.value.validate()
    if (!valid) return

    submittingType.value = true

    // 准备实体类型数据
    const typeData = {
      name: toRaw(typeForm.value.name),
      description: toRaw(typeForm.value.description),
      icon: toRaw(typeForm.value.icon),
      color: toRaw(typeForm.value.color),
      fields: toRaw(typeForm.value.fields).map(({ key, ...field }) => field), // 移除key属性
      fixedFields: FIXED_FIELDS
    }

    if (isEditTypeMode.value && typeForm.value.id) {
      // 更新类型
      await window.api.entities.updateType(toRaw(typeForm.value.id), typeData)
      ElMessage.success('类型更新成功')
    } else {
      // 创建类型
      await window.api.entities.createType(toRaw(typeData))
      ElMessage.success('类型创建成功')
    }

    typeDialogVisible.value = false
    await store.fetchEntityTypes()
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error('操作失败')
  } finally {
    submittingType.value = false
  }
}

// 对话框关闭处理
const handleTypeDialogClose = () => {
  if (submittingType.value) return // 提交中不允许关闭

  typeDialogVisible.value = false
}

// 添加自定义字段
const addCustomField = () => {
  const newField: CustomField = {
    key: Date.now().toString(), // 用于v-for的唯一key
    id: '',
    name: '',
    type: 'text',
    required: false,
    defaultValue: '',
    description: '',
    options: [''] // 下拉框默认有一个空选项
  }
  typeForm.value.fields.push(newField)
}

// 删除自定义字段
const removeCustomField = (index: number) => {
  try {
    typeForm.value.fields.splice(index, 1)
  } catch (error) {
    ElMessage.error('删除字段失败')
  }
}

// 字段类型变化处理
const onFieldTypeChange = (field: CustomField, index: number) => {
  // 根据字段类型重置相关配置
  if (field.type === 'select') {
    if (!field.options || field.options.length === 0) {
      field.options = ['']
    }
  } else {
    // 非下拉框类型清除选项
    field.options = undefined

    // 重置默认值类型
    if (field.type === 'boolean') {
      field.defaultValue = false
    } else if (field.type === 'number') {
      field.defaultValue = undefined
    } else if (field.type === 'date') {
      field.defaultValue = undefined
    } else {
      field.defaultValue = ''
    }
  }
}

// 添加下拉框选项
const addFieldOption = (field: CustomField) => {
  if (!field.options) {
    field.options = []
  }
  field.options.push('')
}

// 删除下拉框选项
const removeFieldOption = (field: CustomField, optionIndex: number) => {
  if (!field.options || field.options.length <= 1) {
    ElMessage.warning('至少需要保留一个选项')
    return
  }
  field.options.splice(optionIndex, 1)
}

const deleteEntity = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个实体吗？', '删除实体', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    // 显示进度指示器
    ElMessage.info({
      message: '正在删除实体...',
      duration: 0,
      key: 'delete-progress'
    })

    try {
      await window.api.entities.deleteEntity(id)
      ElMessage.closeAll()
      ElMessage.success('实体删除成功')
      await store.fetchEntities()
    } catch (deleteError) {
      ElMessage.closeAll()
      throw deleteError
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除实体失败:', error)
      ElMessage.error('删除实体失败')
    }
  }
}

const deleteEntityType = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个实体类型吗？删除前请确保相关的实体已删除',
      '删除类型',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const success = await window.api.entities.deleteType(id)
    if (success) {
      ElMessage.success('类型删除成功')
      await store.refreshEntities()
    } else {
      ElMessage.error('类型删除失败，删除前请确保相关的实体已删除')
    }
  } catch {
    ElMessage.success('类型删除失败，删除前请确保相关的实体已删除')
  }
}

const handleBatchDelete = async () => {
  if (selectedEntities.value.length === 0) return

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedEntities.value.length} 个实体吗？`,
      '批量删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 显示进度指示器
    ElMessage.info({
      message: `正在删除 ${selectedEntities.value.length} 个实体...`,
      duration: 0,
      showClose: false,
      key: 'batch-delete-progress'
    })

    try {
      await window.api.entities.batchDelete(toRaw(selectedEntities.value))
      ElMessage.closeAll()
      ElMessage.success(`成功删除 ${selectedEntities.value.length} 个实体`)
      selectedEntities.value = []
      await store.fetchEntities()
    } catch (deleteError) {
      ElMessage.closeAll()
      throw deleteError
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error('批量删除失败')
    }
  }
}

const handleExport = async () => {
  try {
    const result = await window.api.utils.showSaveDialog({
      title: '导出实体',
      filters: [{ name: 'JSON文件', extensions: ['json'] }],
      defaultPath: `entities_${Date.now()}.json`
    })

    if (!result.canceled && result.filePath) {
      // 显示加载状态
      let loadingInstance: { close: () => void } | null = null
      try {
        loadingInstance = (ElMessage as any).info({
          message: '正在导出实体...',
          duration: 0
        })

        if (!result.canceled && result.filePath) {
          const filePath = result.filePath
          const selectedRow = entityTable.value?.getSelectionRows()
          const exportEntityIds = selectedRow?.map((entity) => entity._id)
          // 调用IPC导出功能
          const exportedData = await window.api.entities.exportEntities(filePath, {
            ids: exportEntityIds
          })
          loadingInstance!.close()
          ElMessage.success(`成功导出 ${exportedData ? JSON.parse(exportedData).length : 0} 个实体`)
        }
      } catch (exportError) {
        loadingInstance?.close()
        const errorMessage = exportError instanceof Error ? exportError.message : '未知错误'
        ElMessage.error(`导出失败: ${errorMessage}`)
      }
    }
  } catch (error) {
    console.error('文件保存对话框失败:', error)
    ElMessage.error('文件保存失败')
  }
}

const handleImport = async () => {
  try {
    const result = await window.api.utils.showOpenDialog({
      title: '导入实体',
      filters: [{ name: 'JSON文件', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]

      // 显示加载状态
      let loadingInstance: { close: () => void } | null = null
      try {
        loadingInstance = (ElMessage as any).info({
          message: '正在导入实体...',
          duration: 0
        })

        // 调用IPC导入功能
        const importedCount = await window.api.entities.importEntities(
          filePath,
          selectedTypeFilter.value || undefined
        )

        loadingInstance!.close()
        ElMessage.success(`成功导入 ${importedCount} 个实体`)

        // 刷新实体列表
        await store.refreshEntities()
      } catch (importError) {
        loadingInstance?.close()
        const errorMessage = importError instanceof Error ? importError.message : '未知错误'
        ElMessage.error(`导入失败: ${errorMessage}`)
      }
    }
  } catch (error) {
    console.error('文件选择失败:', error)
    ElMessage.error('文件选择失败')
  }
}

const handleSearch = debounce(() => {
  currentPage.value = 1 // 搜索时重置到第一页
}, 300)

const handleSelectionChange = (selection: EntityInstance[]) => {
  selectedEntities.value = selection.map((e) => e._id)
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
}

const handleCurrentChange = (page: number) => {
  currentPage.value = page
}

const formatDate = (timestamp: number, format: 'short' | 'full' = 'short') => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  if (format === 'short') {
    return date.toLocaleDateString('zh-CN')
  } else {
    return date.toLocaleString('zh-CN')
  }
}

const getEntityTypeName = (typeId: string) => {
  const type = entityTypes.value.find((t) => t.id === typeId)
  return type?.name || typeId
}

const getEntityTypeColor = (typeId: string) => {
  const type = entityTypes.value.find((t) => t.id === typeId)
  return type?.color || '#8a6df7'
}

const getEntityTypeIcon = (typeId: string) => {
  const type = entityTypes.value.find((t) => t.id === typeId)
  return type?.icon || 'Folder'
}

const getEntityCountByType = (typeId: string) => {
  return entities.value.filter((e) => e._type === typeId).length
}

const getEntityFieldsData = (entity: EntityInstance) => {
  const type = entityTypes.value.find((t) => t.id === entity._type)
  if (!type) return []

  const fields = [...type.fixedFields, ...type.fields]
  return fields.map((field) => ({
    name: field.name,
    value: entity[field.id] ?? '-',
    type: field.type
  }))
}

// 初始化加载数据
onMounted(() => {
  store.refreshEntities()
})
</script>

<style scoped lang="scss">
.entities-view {
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
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }
  }

  .entity-stats {
    margin-bottom: 24px;
  }

  .view-content {
    flex: 1;
    display: flex;
    flex-direction: column;

    .entity-tabs {
      flex: 1;
      display: flex;
      flex-direction: column;

      :deep(.el-tabs__content) {
        flex: 1;
        overflow: auto;
      }
    }

    .entity-list-container {
      height: 100%;
      display: flex;
      flex-direction: column;

      .list-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
        padding: 8px 0;

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      .list-table {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;

        .entity-name-cell {
          display: flex;
          align-items: center;
          gap: 8px;

          .entity-icon {
            color: var(--el-text-color-secondary);
          }
        }

        .pagination-container {
          padding: 16px 0;
          display: flex;
          justify-content: center;
          border-top: 1px solid var(--el-border-color-light);
          margin-top: 16px;
        }

        .empty-state {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
    }

    .entity-types-container {
      .types-toolbar {
        margin-bottom: 16px;
      }

      .types-grid {
        .type-card {
          border: 1px solid var(--el-border-color);
          background-color: var(--el-bg-color);
          margin-bottom: 16px;

          .type-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;

            .type-icon {
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

            .type-title {
              flex: 1;

              h4 {
                margin: 0 0 4px 0;
                font-size: 16px;
                color: var(--el-text-color-primary);
              }

              .type-meta {
                display: flex;
                align-items: center;
                gap: 8px;

                .type-count {
                  font-size: 12px;
                  color: var(--el-text-color-secondary);
                }
              }
            }
          }

          .type-description {
            color: var(--el-text-color-regular);
            font-size: 13px;
            line-height: 1.5;
            margin-bottom: 12px;
            min-height: 40px;
          }

          .type-actions {
            display: flex;
            justify-content: flex-end;
            padding-top: 12px;
            border-top: 1px solid var(--el-border-color-light);
          }
        }

        .empty-state {
          margin-top: 48px;
        }
      }
    }
  }
}

.entity-detail {
  .detail-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;

    .detail-icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .detail-title {
      flex: 1;

      h3 {
        margin: 0 0 8px 0;
        font-size: 20px;
        color: var(--el-text-color-primary);
      }

      .detail-meta {
        display: flex;
        align-items: center;
        gap: 12px;

        .detail-id {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }

  .detail-content {
    h4 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: var(--el-text-color-primary);
    }
  }
}

// 实体类型对话框样式
.form-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  border-bottom: 2px solid var(--el-color-primary);
  padding-bottom: 8px;
}

.empty-fields {
  padding: 20px;
  text-align: center;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  background-color: var(--el-fill-color-lighter);
}

.fields-list {
  .field-item {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.field-card {
  border: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);

  .field-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--el-border-color-lighter);

    .field-index {
      font-weight: 500;
      color: var(--el-color-primary);
      font-size: 14px;
    }
  }

  .field-content {
    :deep(.el-form-item) {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

.options-container {
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  padding: 12px;
  background-color: var(--el-fill-color-extra-light);

  .option-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
