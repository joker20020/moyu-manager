<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="600px"
    :before-close="handleCancel"
    :close-on-click-modal="false"
  >
    <el-form
      ref="entityFormRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      label-position="left"
      @submit.prevent="handleConfirm"
    >
      <!-- 实体类型选择 (仅在创建时显示) -->
      <el-form-item v-if="!isEditMode" label="实体类型" prop="_type" required>
        <el-select
          v-model="formData._type"
          placeholder="选择实体类型"
          style="width: 100%"
          @change="onEntityTypeChange"
        >
          <el-option
            v-for="type in entityTypes"
            :key="type.id"
            :label="type.name"
            :value="type.id"
            :style="{ color: type.color }"
          >
            <div style="display: flex; align-items: center">
              <span style="margin-right: 8px">{{ type.name }}</span>
              <el-tag size="small">{{ type.fields.length }} 字段</el-tag>
            </div>
          </el-option>
        </el-select>
        <div class="form-hint" v-if="selectedEntityType">
          {{ selectedEntityType.description }}
        </div>
      </el-form-item>

      <!-- 固定字段: 名称 -->
      <el-form-item label="名称" prop="name" required>
        <el-input v-model="formData.name" placeholder="输入实体名称" />
      </el-form-item>

      <!-- 动态字段 (基于选择的实体类型) -->
      <template v-if="selectedEntityType">
        <el-form-item
          v-for="field in selectedEntityType.fields"
          :key="field.id"
          :label="field.name"
          :prop="field.id"
          :required="field.required"
        >
          <!-- 文本输入 -->
          <el-input
            v-if="field.type === 'text'"
            v-model="formData[field.id]"
            :placeholder="field.description || `输入${field.name}`"
          />

          <!-- 数字输入 -->
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="formData[field.id]"
            :placeholder="field.description"
            style="width: 100%"
          />

          <!-- 日期选择 -->
          <el-date-picker
            v-else-if="field.type === 'date'"
            v-model="formData[field.id]"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            format="YYYY-MM-DD"
            value-format="x"
          />

          <!-- 下拉选择 -->
          <el-select
            v-else-if="field.type === 'select'"
            v-model="formData[field.id]"
            :placeholder="field.description || `选择${field.name}`"
            style="width: 100%"
          >
            <el-option
              v-for="option in field.options"
              :key="option"
              :label="option"
              :value="option"
            />
          </el-select>

          <!-- 布尔开关 -->
          <el-switch
            v-else-if="field.type === 'boolean'"
            v-model="formData[field.id]"
            :active-text="field.description || '是'"
            :inactive-text="field.description || '否'"
          />

          <!-- 未知类型显示为文本 -->
          <el-input
            v-else
            v-model="formData[field.id]"
            :placeholder="`未知类型: ${field.type}`"
            disabled
          />
          <div v-if="field.description" class="form-hint">
            {{ field.description }}
          </div>
        </el-form-item>
      </template>

      <!-- 无实体类型时的提示 -->
      <div v-else-if="!selectedEntityType && isEditMode" class="empty-fields">
        无法加载实体类型信息
      </div>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="submitting">
          {{ isEditMode ? '更新' : '创建' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { EntityType, EntityInstance } from '../../../shared/types/entities'
import { ElMessage } from 'element-plus'

interface Props {
  visible: boolean
  entityTypes: EntityType[]
  entity?: EntityInstance // 编辑时传入的实体数据
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  entityTypes: () => [],
  entity: undefined
})

const emit = defineEmits<{
  (e: 'confirm', entityData: Partial<EntityInstance>): void
  (e: 'cancel'): void
}>()

// 对话框可见性
const dialogVisible = ref(false)
watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
    if (val) {
      // 重置表单数据
      resetFormData()
    }
  },
  { immediate: true }
)

// 表单引用
const entityFormRef = ref<FormInstance>()

// 表单数据
const formData = ref<Record<string, any>>({
  _type: '',
  name: ''
})

// 表单验证规则
const formRules = computed<FormRules>(() => {
  const rules: FormRules = {
    _type: [{ required: true, message: '请选择实体类型', trigger: 'change' }],
    name: [{ required: true, message: '请输入实体名称', trigger: 'blur' }]
  }

  // 为当前实体类型的必填字段添加验证规则
  if (selectedEntityType.value) {
    selectedEntityType.value.fields.forEach((field) => {
      if (field.required) {
        rules[field.id] = [{ required: true, message: `请输入${field.name}`, trigger: 'blur' }]
      }
    })
  }

  return rules
})

// 是否为编辑模式
const isEditMode = computed(() => !!props.entity)

// 对话框标题
const dialogTitle = computed(() => (isEditMode.value ? '编辑实体' : '新建实体'))

// 当前选择的实体类型
const selectedEntityType = computed<EntityType | undefined>(() => {
  const typeId = formData.value._type
  if (!typeId) return undefined
  return props.entityTypes.find((type) => type.id === typeId)
})

// 重置表单数据
const resetFormData = () => {
  // 默认值
  const defaultData: Record<string, any> = {
    _type: '',
    name: ''
  }

  // 如果是编辑模式，使用传入的实体数据
  if (props.entity) {
    Object.assign(defaultData, props.entity)
    // 确保 _type 和 name 存在
    defaultData._type = props.entity._type
    defaultData.name = props.entity.name || ''
  }

  formData.value = defaultData

  // 如果实体类型已知，为字段设置默认值
  if (selectedEntityType.value) {
    selectedEntityType.value.fields.forEach((field) => {
      if (formData.value[field.id] === undefined && field.defaultValue !== undefined) {
        formData.value[field.id] = field.defaultValue
      }
    })
  }

  // 重置表单验证状态
  nextTick(() => {
    if (entityFormRef.value) {
      entityFormRef.value.clearValidate()
    }
  })
}

// 实体类型变化处理
const onEntityTypeChange = () => {
  // 清除之前的动态字段数据
  if (selectedEntityType.value) {
    selectedEntityType.value.fields.forEach((field) => {
      if (formData.value[field.id] !== undefined && !props.entity) {
        delete formData.value[field.id]
      }
    })
  }

  // 为字段设置默认值 (仅创建模式)
  if (selectedEntityType.value && !props.entity) {
    selectedEntityType.value.fields.forEach((field) => {
      if (field.defaultValue !== undefined && formData.value[field.id] === undefined) {
        formData.value[field.id] = field.defaultValue
      }
    })
  }
}

// 提交状态
const submitting = ref(false)

// 确认按钮处理
const handleConfirm = async () => {
  if (!entityFormRef.value) return

  try {
    // 验证表单
    const valid = await entityFormRef.value.validate()
    if (!valid) return

    submitting.value = true

    // 准备实体数据
    const entityData: Partial<EntityInstance> = {
      _type: formData.value._type,
      name: formData.value.name
    }

    // 添加动态字段值
    if (selectedEntityType.value) {
      selectedEntityType.value.fields.forEach((field) => {
        const value = formData.value[field.id]
        if (value !== undefined && value !== null && value !== '') {
          entityData[field.id] = value
        }
      })
    }

    // 如果是编辑模式，传递 ID
    if (props.entity) {
      entityData._id = props.entity._id
    }

    // 触发确认事件
    emit('confirm', entityData)
  } catch (error) {
    console.error('表单验证失败:', error)
    ElMessage.error('请检查表单输入')
  } finally {
    submitting.value = false
  }
}

// 取消按钮处理
const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped lang="scss">
.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.empty-fields {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  margin-bottom: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
