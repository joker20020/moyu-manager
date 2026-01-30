<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`插件权限管理 - ${pluginName || pluginId}`"
    width="700px"
    :before-close="handleCancel"
    :close-on-click-modal="false"
  >
    <div v-if="loading" class="loading-container">
      <el-icon class="loading-icon"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else class="permissions-dialog">
      <!-- 插件基本信息 -->
      <div class="plugin-info-section">
        <h4>插件信息</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">插件名称:</span>
            <span class="info-value">{{ plugin?.manifest.name || '未知' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">版本:</span>
            <span class="info-value">{{ plugin?.manifest.version || '未知' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">作者:</span>
            <span class="info-value">{{ plugin?.manifest.author || '未知' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">状态:</span>
            <el-tag size="small" :type="plugin?.enabled ? 'success' : 'info'">
              {{ plugin?.enabled ? '已启用' : '已禁用' }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">生命周期:</span>
            <el-tag size="small" :type="getPluginStateTagType(plugin?.state)">
              {{ getPluginStateText(plugin?.state) }}
            </el-tag>
          </div>
        </div>
      </div>

      <el-divider />

      <!-- 权限管理 -->
      <div class="permissions-section">
        <div class="section-header">
          <h4>权限管理</h4>
          <div class="header-actions">
            <el-button size="small" @click="selectAll">全选</el-button>
            <el-button size="small" @click="clearAll">清空</el-button>
            <el-button size="small" @click="resetToDefault">重置为默认</el-button>
          </div>
        </div>

        <p class="section-description">
          以下是插件请求的权限列表。您可以根据需要授予或撤销这些权限。
        </p>

        <div class="permissions-list">
          <div v-for="permission in allPermissions" :key="permission.id" class="permission-item">
            <div class="permission-info">
              <div class="permission-header">
                <el-checkbox
                  v-model="grantedPermissionsMap[permission.id]"
                  @change="handlePermissionChange(permission.id, $event)"
                >
                  <span class="permission-name">{{ permission.name }}</span>
                </el-checkbox>
                <div class="permission-tags">
                  <el-tag v-if="permission.required" size="small" type="warning">必需</el-tag>
                  <el-tag size="small" :type="getPermissionLevelTag(permission.level)">
                    {{
                      permission.level === 'high'
                        ? '高'
                        : permission.level === 'medium'
                          ? '中'
                          : '低'
                    }}
                  </el-tag>
                </div>
              </div>
              <p class="permission-description">{{ permission.description }}</p>
              <div class="permission-usage">
                <span class="usage-label">使用场景: </span>
                <span class="usage-text">{{ permission.usage }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="allPermissions.length === 0" class="empty-permissions">
          <el-icon><Unlock /></el-icon>
          <p>此插件不需要任何特殊权限</p>
        </div>
      </div>

      <el-divider />

      <!-- 权限统计 -->
      <div class="permissions-stats">
        <div class="stats-item">
          <span class="stats-label">总权限数:</span>
          <span class="stats-value">{{ allPermissions.length }}</span>
        </div>
        <div class="stats-item">
          <span class="stats-label">已授予:</span>
          <span class="stats-value granted">{{ grantedCount }}</span>
        </div>
        <div class="stats-item">
          <span class="stats-label">必需权限:</span>
          <span class="stats-value required">{{ requiredCount }}</span>
        </div>
        <div class="stats-item">
          <span class="stats-label">高风险权限:</span>
          <span class="stats-value high-risk">{{ highRiskCount }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <el-checkbox v-model="saveAsDefault" label="保存为默认权限配置" size="small" />
        </div>
        <div class="footer-right">
          <el-button @click="handleCancel">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, toRaw } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, Unlock } from '@element-plus/icons-vue'
import {
  PluginLifecycleState,
  PLUGIN_PERMISSIONS as PERMISSIONS
} from '../../../shared/types/plugins'
import type { Plugin, PluginPermission } from '../../../shared/types/plugins'

// 权限描述映射
const PERMISSION_DESCRIPTIONS: Record<
  string,
  { description: string; usage: string; level: 'low' | 'medium' | 'high' }
> = {
  [PERMISSIONS.GET_ENTITY]: {
    description: '读取实体数据',
    usage: '允许插件查看实体列表和详细信息',
    level: 'low'
  },
  [PERMISSIONS.CREATE_ENTITY]: {
    description: '写入实体数据',
    usage: '允许插件创建、修改实体数据',
    level: 'medium'
  },
  [PERMISSIONS.DELETE_ENTITY]: {
    description: '删除实体数据',
    usage: '允许插件删除实体数据',
    level: 'high'
  },
  [PERMISSIONS.OPEN_FILE]: {
    description: '读取文件',
    usage: '允许插件读取文件系统中的文件',
    level: 'medium'
  },
  [PERMISSIONS.SAVE_FILE]: {
    description: '写入文件',
    usage: '允许插件创建、修改和删除文件',
    level: 'high'
  },
  [PERMISSIONS.READ_CONFIG]: {
    description: '读取配置',
    usage: '允许插件读取应用程序配置',
    level: 'low'
  },
  [PERMISSIONS.WRITE_CONFIG]: {
    description: '写入配置',
    usage: '允许插件修改应用程序配置',
    level: 'high'
  },
  [PERMISSIONS.UI_SHOW]: {
    description: '显示UI组件',
    usage: '允许插件在界面中添加新的UI组件',
    level: 'low'
  },
  [PERMISSIONS.UI_MODIFY]: {
    description: '修改UI',
    usage: '允许插件修改现有界面布局和样式',
    level: 'medium'
  },
  [PERMISSIONS.NETWORK_ACCESS]: {
    description: '网络访问',
    usage: '允许插件访问网络资源',
    level: 'high'
  },
  [PERMISSIONS.EVENTS_SUBSCRIBE]: {
    description: '订阅系统事件',
    usage: '允许插件订阅应用事件（如实体创建、文件保存等）',
    level: 'medium'
  }
}

// Props
const props = defineProps<{
  modelValue: boolean
  pluginId: string
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [pluginId: string, permissions: PluginPermission[]]
}>()

// 响应式状态
const dialogVisible = ref(false)
const plugin = ref<Plugin | null>(null)
const requestedPermissions = ref<PluginPermission[]>([])
const grantedPermissions = ref<PluginPermission[]>([])
const grantedPermissionsMap = ref<Record<string, boolean>>({})
const loading = ref(false)
const saving = ref(false)
const saveAsDefault = ref(false)

// 计算属性
const pluginName = computed(() => plugin.value?.manifest.name || props.pluginId)
const allPermissions = computed(() => {
  return requestedPermissions.value.map((perm) => {
    const info = PERMISSION_DESCRIPTIONS[perm] || {
      description: '未知权限',
      usage: '未知的权限',
      level: 'medium' as const
    }
    const isRequired = true // 插件请求的权限视为必需权限
    return {
      id: perm,
      name: perm,
      description: info.description,
      usage: info.usage,
      level: info.level,
      required: isRequired
    }
  })
})

const grantedCount = computed(() => {
  return Object.values(grantedPermissionsMap.value).filter(Boolean).length
})

const requiredCount = computed(() => {
  return allPermissions.value.filter((p) => p.required).length
})

const highRiskCount = computed(() => {
  return allPermissions.value.filter((p) => p.level === 'high').length
})

// 方法
const getPermissionLevelTag = (level: string) => {
  switch (level) {
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    default:
      return 'info'
  }
}

const getPluginStateText = (state?: string) => {
  if (!state) return '未知'
  switch (state) {
    case PluginLifecycleState.UNLOADED:
      return '未加载'
    case PluginLifecycleState.LOADING:
      return '加载中'
    case PluginLifecycleState.LOADED:
      return '已加载'
    case PluginLifecycleState.INITIALIZING:
      return '初始化中'
    case PluginLifecycleState.INITIALIZED:
      return '已初始化'
    case PluginLifecycleState.ACTIVATING:
      return '激活中'
    case PluginLifecycleState.ACTIVE:
      return '已激活'
    case PluginLifecycleState.DEACTIVATING:
      return '停用中'
    case PluginLifecycleState.INACTIVE:
      return '已停用'
    case PluginLifecycleState.ERROR:
      return '错误'
    default:
      return state
  }
}

const getPluginStateTagType = (state?: string) => {
  if (!state) return ''
  switch (state) {
    case PluginLifecycleState.ACTIVE:
      return 'success'
    case PluginLifecycleState.INACTIVE:
    case PluginLifecycleState.INITIALIZED:
      return 'info'
    case PluginLifecycleState.ERROR:
      return 'danger'
    case PluginLifecycleState.LOADING:
    case PluginLifecycleState.INITIALIZING:
    case PluginLifecycleState.ACTIVATING:
    case PluginLifecycleState.DEACTIVATING:
      return 'warning'
    default:
      return ''
  }
}

const selectAll = () => {
  allPermissions.value.forEach((perm) => {
    grantedPermissionsMap.value[perm.id] = true
  })
}

const clearAll = () => {
  allPermissions.value.forEach((perm) => {
    grantedPermissionsMap.value[perm.id] = false
  })
}

const resetToDefault = async () => {
  try {
    // 重置为插件请求的必需权限
    allPermissions.value.forEach((perm) => {
      grantedPermissionsMap.value[perm.id] = perm.required
    })
    ElMessage.success('已重置为默认权限')
  } catch (error) {
    console.error('Failed to reset permissions:', error)
  }
}

const handlePermissionChange = (permissionId: string, granted: boolean) => {
  grantedPermissionsMap.value[permissionId] = granted
}

const handleCancel = () => {
  dialogVisible.value = false
  emit('update:modelValue', false)
}

const handleSave = async () => {
  saving.value = true
  try {
    const permissionsToGrant: PluginPermission[] = []
    Object.entries(grantedPermissionsMap.value).forEach(([perm, granted]) => {
      if (granted) {
        permissionsToGrant.push(perm as PluginPermission)
      }
    })

    // 使用新的 setGrantedPermissions API
    const success = await window.api.plugins.setGrantedPermissions(
      toRaw(props.pluginId),
      permissionsToGrant
    )
    if (success) {
      ElMessage.success('权限设置已保存')
      emit('saved', props.pluginId, permissionsToGrant)
      dialogVisible.value = false
      emit('update:modelValue', false)
    } else {
      ElMessage.error('保存权限失败')
    }
  } catch (error) {
    console.error('Failed to save permissions:', error)
    ElMessage.error('保存权限时发生错误')
  } finally {
    saving.value = false
  }
}

// 加载插件信息和权限
const loadData = async () => {
  loading.value = true
  try {
    // 加载插件信息
    const pluginData = await window.api.plugins.getPlugin(props.pluginId)
    plugin.value = pluginData
    console.log(toRaw(props.pluginId))

    // 获取插件请求的权限（从manifest）
    const requested = pluginData?.manifest.permissions || []
    requestedPermissions.value = requested

    // 获取当前已授予的权限（使用新的 getGrantedPermissions API）
    const granted = await window.api.plugins.getGrantedPermissions(props.pluginId)
    grantedPermissions.value = granted

    // 初始化权限映射
    const map: Record<string, boolean> = {}
    requested.forEach((perm) => {
      map[perm] = granted.includes(perm)
    })
    grantedPermissionsMap.value = map
  } catch (error) {
    console.error('Failed to load plugin permissions:', error)
    ElMessage.error('加载插件权限信息失败')
  } finally {
    loading.value = false
  }
}

// 监听props变化
watch(
  () => props.modelValue,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal) {
      loadData()
    }
  }
)

watch(
  () => props.pluginId,
  () => {
    if (dialogVisible.value) {
      loadData()
    }
  }
)

// 初始化
onMounted(() => {
  dialogVisible.value = props.modelValue
  if (props.modelValue) {
    loadData()
  }
})
</script>

<style scoped lang="scss">
.permissions-dialog {
  .plugin-info-section {
    margin-bottom: 20px;

    h4 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: var(--el-text-color-primary);
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

      .info-item {
        display: flex;
        align-items: center;
        gap: 8px;

        .info-label {
          font-size: 13px;
          color: var(--el-text-color-secondary);
          min-width: 60px;
        }

        .info-value {
          font-size: 13px;
          color: var(--el-text-color-regular);
        }
      }
    }
  }

  .permissions-section {
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      h4 {
        margin: 0;
        font-size: 16px;
        color: var(--el-text-color-primary);
      }

      .header-actions {
        display: flex;
        gap: 8px;
      }
    }

    .section-description {
      margin: 0 0 16px 0;
      color: var(--el-text-color-secondary);
      font-size: 13px;
      line-height: 1.5;
    }

    .permissions-list {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid var(--el-border-color);
      border-radius: 4px;
      padding: 12px;

      .permission-item {
        padding: 12px;
        border-bottom: 1px solid var(--el-border-color-light);

        &:last-child {
          border-bottom: none;
        }

        .permission-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;

          .permission-name {
            font-weight: 500;
            color: var(--el-text-color-primary);
          }

          .permission-tags {
            display: flex;
            gap: 6px;
          }
        }

        .permission-description {
          margin: 0 0 6px 0;
          color: var(--el-text-color-regular);
          font-size: 13px;
        }

        .permission-usage {
          display: flex;
          align-items: flex-start;
          gap: 6px;

          .usage-label {
            font-size: 12px;
            color: var(--el-text-color-secondary);
            white-space: nowrap;
          }

          .usage-text {
            font-size: 12px;
            color: var(--el-text-color-regular);
            line-height: 1.4;
          }
        }
      }
    }

    .empty-permissions {
      text-align: center;
      padding: 40px 20px;
      color: var(--el-text-color-secondary);

      .el-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }
  }

  .permissions-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    text-align: center;

    .stats-item {
      .stats-label {
        display: block;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        margin-bottom: 4px;
      }

      .stats-value {
        display: block;
        font-size: 20px;
        font-weight: 600;
        color: var(--el-text-color-primary);

        &.granted {
          color: var(--el-color-success);
        }

        &.required {
          color: var(--el-color-warning);
        }

        &.high-risk {
          color: var(--el-color-danger);
        }
      }
    }
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;

  .loading-icon {
    font-size: 40px;
    color: var(--el-text-color-secondary);
    margin-bottom: 16px;
    animation: rotate 1.5s linear infinite;
  }

  span {
    color: var(--el-text-color-secondary);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .footer-left {
    flex: 1;
  }

  .footer-right {
    display: flex;
    gap: 12px;
  }
}
</style>
