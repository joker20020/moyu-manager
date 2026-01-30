<template>
  <div class="plugins-view">
    <div class="view-header">
      <h2>插件管理</h2>
      <p class="view-description">扩展应用功能，安装和管理插件</p>
    </div>

    <div class="plugins-controls">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-input v-model="searchQuery" placeholder="搜索插件..." clearable>
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-col>
        <el-col :span="12">
          <div class="filter-buttons">
            <el-button-group>
              <el-button
                :type="filterType === 'all' ? 'primary' : 'default'"
                @click="filterType = 'all'"
              >
                全部
              </el-button>
              <el-button
                :type="filterType === 'enabled' ? 'primary' : 'default'"
                @click="filterType = 'enabled'"
              >
                已启用
              </el-button>
              <el-button
                :type="filterType === 'disabled' ? 'primary' : 'default'"
                @click="filterType = 'disabled'"
              >
                已禁用
              </el-button>
              <el-button
                :type="filterType === 'system' ? 'primary' : 'default'"
                @click="filterType = 'system'"
              >
                系统插件
              </el-button>
            </el-button-group>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="action-buttons">
            <el-dropdown @command="handleInstallCommand">
              <el-button type="primary">
                <el-icon><Plus /></el-icon>
                安装插件<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="directory">
                    <el-icon><Folder /></el-icon>
                    从目录安装
                  </el-dropdown-item>
                  <el-dropdown-item command="git">
                    <el-icon><Link /></el-icon>
                    从Git仓库安装
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button @click="checkForUpdates" :loading="checkingUpdates">
              <el-icon><Refresh /></el-icon>
              检查更新
            </el-button>
            <el-button @click="refreshPlugins">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="plugins-content">
      <el-tabs v-model="activeTab" class="plugins-tabs">
        <el-tab-pane label="已安装插件" name="installed">
          <div class="plugins-grid">
            <el-row :gutter="16">
              <el-col :span="8" v-for="plugin in filteredPlugins" :key="plugin.manifest.id">
                <el-card class="plugin-card" shadow="hover">
                  <div class="plugin-header">
                    <div class="plugin-icon">
                      <el-icon v-if="plugin.manifest?.icon === 'grid'"><Grid /></el-icon>
                      <el-icon v-if="plugin.manifest?.icon === 'tools'"><Tools /></el-icon>
                      <el-icon v-if="plugin.manifest?.icon === 'chart'"><DataLine /></el-icon>
                      <el-icon v-if="plugin.manifest?.icon === 'code'"><Edit /></el-icon>
                      <el-icon v-else><Grid /></el-icon>
                    </div>
                    <div class="plugin-title">
                      <h4>{{ plugin.manifest?.name || plugin.name }}</h4>
                      <div class="plugin-meta">
                        <span class="plugin-version"
                          >v{{ plugin.manifest?.version || plugin.version }}</span
                        >
                        <el-tag size="small" :type="plugin.enabled ? 'success' : 'info'">
                          {{ plugin.enabled ? '已启用' : '已禁用' }}
                        </el-tag>
                        <el-tag
                          v-if="plugin.manifest?.permissions?.length"
                          size="small"
                          type="warning"
                        >
                          {{ plugin.manifest.permissions.length }} 权限
                        </el-tag>
                        <el-tooltip
                          v-if="plugin.manifest?.repository"
                          effect="dark"
                          placement="top"
                        >
                          <template #content>
                            <div style="max-width: 300px; word-break: break-all">
                              {{ plugin.manifest.repository }}
                            </div>
                          </template>
                          <el-tag size="small" type="success">
                            <el-icon size="10"><Link /></el-icon>
                            Git
                          </el-tag>
                        </el-tooltip>
                      </div>
                    </div>
                  </div>

                  <div class="plugin-description">
                    {{ plugin.manifest?.description || plugin.description }}
                  </div>

                  <div class="plugin-info">
                    <div class="info-item">
                      <span class="info-label">作者:</span>
                      <span class="info-value">{{ plugin.manifest?.author || plugin.author }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">兼容性:</span>
                      <span class="info-value">{{
                        plugin.manifest?.compatibility || plugin.compatibility
                      }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">类别:</span>
                      <el-tag size="small" type="info">{{
                        plugin.manifest?.category || plugin.category
                      }}</el-tag>
                    </div>
                  </div>

                  <div class="plugin-actions">
                    <el-switch
                      v-model="plugin.enabled"
                      :active-value="true"
                      :inactive-value="false"
                      size="small"
                      @change="togglePlugin(plugin.manifest.id, $event)"
                    />

                    <el-button type="text" size="small" @click="viewDetails(plugin.manifest.id)">
                      详情
                    </el-button>
                    <el-button
                      type="text"
                      size="small"
                      @click="managePermissions(plugin.manifest.id)"
                    >
                      权限
                    </el-button>
                    <el-button
                      type="text"
                      size="small"
                      style="color: var(--el-color-danger)"
                      @click="uninstallPlugin(plugin.manifest.id)"
                    >
                      卸载
                    </el-button>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>

        <!-- <el-tab-pane label="插件市场" name="market">
          <div class="market-placeholder">
            <div class="placeholder-content">
              <el-icon :size="64" color="var(--el-text-color-secondary)"><Shop /></el-icon>
              <h3>插件市场</h3>
              <p>在这里浏览和安装官方和社区的插件</p>
              <el-button type="primary" size="large">
                <el-icon><Search /></el-icon>
                浏览插件市场
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="开发工具" name="development">
          <div class="dev-tools">
            <div class="dev-section">
              <h3>插件开发</h3>
              <p>创建和调试自定义插件</p>
              <div class="dev-actions">
                <el-button type="primary">
                  <el-icon><Plus /></el-icon>
                  新建插件项目
                </el-button>
                <el-button>
                  <el-icon><FolderOpened /></el-icon>
                  打开插件目录
                </el-button>
                <el-button>
                  <el-icon><Document /></el-icon>
                  开发文档
                </el-button>
              </div>
            </div>

            <div class="dev-section">
              <h3>插件模板</h3>
              <el-row :gutter="16" class="template-grid">
                <el-col :span="8">
                  <el-card class="template-card" shadow="hover">
                    <div class="template-header">
                      <el-icon><Tools /></el-icon>
                      <h4>工具类插件</h4>
                    </div>
                    <p>添加实用工具和功能扩展</p>
                    <el-button type="text" size="small">使用模板</el-button>
                  </el-card>
                </el-col>
                <el-col :span="8">
                  <el-card class="template-card" shadow="hover">
                    <div class="template-header">
                      <el-icon><DataAnalysis /></el-icon>
                      <h4>数据可视化</h4>
                    </div>
                    <p>创建图表和数据分析插件</p>
                    <el-button type="text" size="small">使用模板</el-button>
                  </el-card>
                </el-col>
                <el-col :span="8">
                  <el-card class="template-card" shadow="hover">
                    <div class="template-header">
                      <el-icon><Connection /></el-icon>
                      <h4>集成插件</h4>
                    </div>
                    <p>与外部服务集成</p>
                    <el-button type="text" size="small">使用模板</el-button>
                  </el-card>
                </el-col>
              </el-row>
            </div>
          </div>
        </el-tab-pane> -->
      </el-tabs>
    </div>

    <!-- 插件详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="插件详情" width="600px">
      <div v-if="selectedPlugin" class="plugin-detail">
        <div class="detail-header">
          <div class="detail-icon">
            <el-icon :size="32"><Grid /></el-icon>
          </div>
          <div class="detail-title">
            <h3>{{ selectedPlugin.manifest?.name || selectedPlugin.name }}</h3>
            <div class="detail-meta">
              <span class="detail-version"
                >v{{ selectedPlugin.manifest?.version || selectedPlugin.version }}</span
              >
              <el-tag :type="selectedPlugin.enabled ? 'success' : 'info'">
                {{ selectedPlugin.enabled ? '已启用' : '已禁用' }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="detail-description">
          {{ selectedPlugin.manifest?.description || selectedPlugin.description }}
        </div>

        <el-divider />

        <div class="detail-info">
          <div class="info-row">
            <span class="info-label">作者:</span>
            <span class="info-value">{{
              selectedPlugin.manifest?.author || selectedPlugin.author
            }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">发布日期:</span>
            <span class="info-value">{{
              formatDate(selectedPlugin.manifest?.releaseDate || selectedPlugin.releaseDate)
            }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">兼容版本:</span>
            <span class="info-value">{{
              selectedPlugin.manifest?.compatibility || selectedPlugin.compatibility
            }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">许可证:</span>
            <span class="info-value">{{
              selectedPlugin.manifest?.license || selectedPlugin.license
            }}</span>
          </div>
          <div class="info-row" v-if="selectedPlugin.manifest?.repository">
            <span class="info-label">仓库:</span>
            <span class="info-value">
              <a :href="selectedPlugin.manifest.repository" target="_blank" class="repository-link">
                <el-icon><Link /></el-icon>
                {{ selectedPlugin.manifest.repository }}
              </a>
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">依赖:</span>
            <span class="info-value">{{
              selectedPlugin.manifest?.dependencies || selectedPlugin.dependencies || '无'
            }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">权限:</span>
            <span class="info-value">
              <span v-if="selectedPlugin.manifest?.permissions?.length">
                {{ selectedPlugin.manifest.permissions.join(', ') }}
              </span>
              <span v-else>无</span>
            </span>
          </div>
        </div>

        <el-divider />

        <div class="detail-actions">
          <el-switch
            v-model="selectedPlugin.enabled"
            :active-value="true"
            :inactive-value="false"
            @change="togglePlugin(selectedPlugin.manifest.id, $event)"
          />
          <span style="margin-left: 8px">{{
            selectedPlugin.enabled ? '禁用插件' : '启用插件'
          }}</span>
          <div style="flex: 1"></div>

          <el-button type="danger" @click="uninstallPlugin(selectedPlugin.id)">卸载</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- Git安装对话框 -->
    <el-dialog
      v-model="gitDialogVisible"
      title="从Git仓库安装插件"
      width="500px"
      :before-close="handleGitDialogClose"
    >
      <div class="git-install-dialog">
        <el-form :model="{ url: gitUrl }" :rules="gitRules" ref="gitFormRef" label-width="100px">
          <el-form-item label="Git仓库URL" prop="url" required>
            <el-input
              v-model="gitUrl"
              placeholder="输入Git仓库URL (http://, https:// 或 git@开头)"
              clearable
              :disabled="installingFromGit"
              @keyup.enter="installFromGit"
            >
              <template #prepend>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="验证状态">
            <div class="validation-status">
              <el-icon v-if="urlValidationStatus === 'valid'" color="var(--el-color-success)">
                <CircleCheck />
              </el-icon>
              <el-icon v-if="urlValidationStatus === 'invalid'" color="var(--el-color-danger)">
                <CircleClose />
              </el-icon>
              <el-icon v-if="urlValidationStatus === 'checking'" class="loading-icon">
                <Loading />
              </el-icon>
              <span class="validation-message">{{ urlValidationMessage }}</span>
            </div>
          </el-form-item>

          <el-form-item label="安装说明">
            <div class="installation-instructions">
              <p class="instruction-text">支持的Git仓库格式：</p>
              <ul class="instruction-list">
                <li>HTTPS: <code>https://github.com/用户名/仓库名.git</code></li>
                <li>SSH: <code>git@github.com:用户名/仓库名.git</code></li>
                <li>HTTP: <code>http://github.com/用户名/仓库名.git</code></li>
              </ul>
              <p class="instruction-text">确保仓库包含有效的 <code>plugin.json</code> 文件。</p>
            </div>
          </el-form-item>
        </el-form>

        <!-- 错误信息显示 -->
        <div v-if="gitError" class="error-message">
          <el-alert
            :title="gitError.title"
            :description="gitError.message"
            type="error"
            show-icon
            :closable="true"
            @close="gitError = null"
          />
        </div>

        <!-- 安装进度 -->
        <div v-if="installingFromGit" class="installation-progress">
          <el-progress
            :percentage="installProgress"
            :status="installProgress === 100 ? 'success' : ''"
            :indeterminate="installProgress === 0"
            :text-inside="true"
            :stroke-width="20"
          />
          <p class="progress-text">{{ installProgressMessage }}</p>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <div class="footer-left">
            <el-checkbox v-model="autoCheckUpdates" label="安装后自动检查更新" size="small" />
          </div>
          <div class="footer-right">
            <el-button @click="gitDialogVisible = false" :disabled="installingFromGit">
              取消
            </el-button>
            <el-button
              type="primary"
              @click="installFromGit"
              :loading="installingFromGit"
              :disabled="!gitUrl.trim() || urlValidationStatus === 'invalid' || installingFromGit"
            >
              {{ installingFromGit ? '安装中...' : '安装插件' }}
            </el-button>
          </div>
        </span>
      </template>
    </el-dialog>

    <!-- 插件更新对话框 -->
    <el-dialog
      v-model="updatesDialogVisible"
      title="插件更新"
      width="600px"
      :before-close="handleUpdatesDialogClose"
    >
      <div class="updates-dialog">
        <div v-if="availableUpdates.length === 0" class="no-updates">
          <el-icon :size="48" color="var(--el-color-success)"><CircleCheck /></el-icon>
          <h3>所有插件都是最新版本</h3>
          <p>没有发现可用的更新</p>
        </div>

        <div v-else class="updates-list">
          <p class="updates-summary">
            发现 <strong>{{ availableUpdates.length }}</strong> 个插件有可用更新：
          </p>

          <el-table :data="availableUpdates" size="small" stripe>
            <el-table-column prop="pluginId" label="插件ID" width="150" />
            <el-table-column label="版本">
              <template #default="{ row }">
                <div class="version-comparison">
                  <span class="current-version">{{ row.currentVersion }}</span>
                  <el-icon><ArrowRight /></el-icon>
                  <span class="latest-version">{{ row.latestVersion }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="changelog" label="更新说明" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  :loading="updatingPlugins.has(row.pluginId)"
                  @click="updatePlugin(row.pluginId)"
                >
                  <el-icon><Upload /></el-icon>
                  更新
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <div class="footer-left">
            <span v-if="availableUpdates.length > 0">
              共 {{ availableUpdates.length }} 个更新可用
            </span>
          </div>
          <div class="footer-right">
            <el-button @click="updatesDialogVisible = false">
              {{ availableUpdates.length === 0 ? '关闭' : '取消' }}
            </el-button>
            <el-button
              v-if="availableUpdates.length > 0"
              type="primary"
              @click="updateAllPlugins"
              :loading="updatingPlugins.size > 0"
            >
              更新全部
            </el-button>
          </div>
        </span>
      </template>
    </el-dialog>

    <!-- 插件权限管理对话框 -->
    <PluginPermissionsDialog
      v-model="permissionsDialogVisible"
      :plugin-id="selectedPluginId"
      @saved="onPermissionsSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PluginPermissionsDialog from '../components/PluginPermissionsDialog.vue'
import {
  Search,
  Plus,
  Refresh,
  Grid,
  Tools,
  DataLine,
  Edit,
  Shop,
  FolderOpened,
  Document,
  DataAnalysis,
  Connection,
  Setting,
  Loading,
  ArrowDown,
  Folder,
  Link,
  CircleCheck,
  CircleClose,
  Upload,
  ArrowRight
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

// 响应式状态
const activeTab = ref('installed')
const searchQuery = ref('')
const filterType = ref('all')
const detailDialogVisible = ref(false)
const selectedPlugin = ref<any>(null)
const plugins = ref<any[]>([])
const loading = ref(false)
const permissionsDialogVisible = ref(false)
const selectedPluginId = ref<string>('')

// Git安装相关状态
const gitDialogVisible = ref(false)
const gitUrl = ref('')
const installingFromGit = ref(false)
const urlValidationStatus = ref<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
const urlValidationMessage = ref('')
const gitError = ref<{ title: string; message: string } | null>(null)
const installProgress = ref(0)
const installProgressMessage = ref('')
const autoCheckUpdates = ref(true)
const gitFormRef = ref<any>(null)
const gitRules = {
  url: [
    { required: true, message: '请输入Git仓库URL', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: any) => {
        if (!value) {
          callback(new Error('请输入Git仓库URL'))
        } else if (
          !value.startsWith('http://') &&
          !value.startsWith('https://') &&
          !value.startsWith('git@')
        ) {
          callback(new Error('URL必须以http://、https://或git@开头'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 更新检查相关状态
const checkingUpdates = ref(false)
const updatesDialogVisible = ref(false)
const availableUpdates = ref<any[]>([])
const updatingPlugins = ref<Set<string>>(new Set())

const store = useAppStore()

// 处理安装命令
const handleInstallCommand = (command: string) => {
  switch (command) {
    case 'directory':
      installFromDirectory()
      break
    case 'git':
      gitDialogVisible.value = true
      break
  }
}

// 获取插件列表
const fetchPlugins = async () => {
  loading.value = true
  try {
    const data = await window.api.plugins.getPlugins()
    plugins.value = data
    store.fetchPlugins()
  } catch (error) {
    console.error('Failed to fetch plugins:', error)
    ElMessage.error('加载插件列表失败')
  } finally {
    loading.value = false
  }
}

// 计算属性
const filteredPlugins = computed(() => {
  let result = plugins.value

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (plugin) =>
        (plugin.manifest?.name || plugin.name).toLowerCase().includes(query) ||
        (plugin.manifest?.description || plugin.description).toLowerCase().includes(query) ||
        (plugin.manifest?.author || plugin.author).toLowerCase().includes(query)
    )
  }

  // 类型过滤
  if (filterType.value === 'enabled') {
    result = result.filter((plugin) => plugin.enabled)
  } else if (filterType.value === 'disabled') {
    result = result.filter((plugin) => !plugin.enabled)
  } else if (filterType.value === 'system') {
    result = result.filter((plugin) => (plugin.manifest?.category || plugin.category) === 'system')
  }

  return result
})

// 方法
const togglePlugin = async (id: string, enabled: boolean) => {
  try {
    if (enabled) {
      await window.api.plugins.enablePlugin(id)
    } else {
      await window.api.plugins.disablePlugin(id)
    }
    // 更新本地状态
    const plugin = plugins.value.find((p) => p.id === id)
    if (plugin) {
      plugin.enabled = enabled
    }
    ElMessage.success(enabled ? '插件已启用' : '插件已禁用')
  } catch (error) {
    console.error('Failed to toggle plugin:', error)
    ElMessage.error('操作失败')
  }
}

const viewDetails = (id: string) => {
  selectedPlugin.value = plugins.value.find((p) => p.manifest.id === id)
  detailDialogVisible.value = true
}

const managePermissions = (id: string) => {
  selectedPluginId.value = id
  permissionsDialogVisible.value = true
}

const onPermissionsSaved = (pluginId: string, permissions: string[]) => {
  // 可以在这里更新插件本地状态，如果需要的话
  ElMessage.success('权限设置已保存')
}

const uninstallPlugin = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要卸载这个插件吗？', '卸载插件', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const success = await window.api.plugins.uninstallPlugin(id)
    if (success) {
      plugins.value = plugins.value.filter((p) => p.id !== id)
      ElMessage.success('插件已卸载')
    } else {
      ElMessage.error('卸载失败')
    }
  } catch {
    // 取消操作
  }
}

const installFromDirectory = async () => {
  try {
    const result = await window.api.utils.showOpenDialog({
      title: '安装插件',
      message: '选择插件目录',
      filters: [{ name: '插件目录', extensions: [] }],
      properties: ['openDirectory']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const source = result.filePaths[0]
      ElMessage.info('正在安装插件...')

      const plugin = await window.api.plugins.installPlugin(source)
      plugins.value.push(plugin)
      ElMessage.success('插件安装成功')
    }
  } catch (error) {
    console.error('Failed to install plugin:', error)
    ElMessage.error('安装失败: ' + (error instanceof Error ? error.message : String(error)))
  }
}

// 验证Git URL
const validateGitUrl = (url: string): { valid: boolean; message: string } => {
  if (!url.trim()) {
    return { valid: false, message: '请输入Git仓库URL' }
  }

  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('git@')) {
    return { valid: false, message: 'URL必须以http://、https://或git@开头' }
  }

  // 基本格式检查
  if (url.startsWith('git@') && !url.includes(':')) {
    return { valid: false, message: 'SSH URL格式应为 git@host:user/repo.git' }
  }

  if ((url.startsWith('http://') || url.startsWith('https://')) && !url.includes('://')) {
    return { valid: false, message: 'HTTP URL格式不正确' }
  }

  return { valid: true, message: 'URL格式正确' }
}

// 监听Git URL变化
watch(gitUrl, (newUrl) => {
  if (!newUrl.trim()) {
    urlValidationStatus.value = 'idle'
    urlValidationMessage.value = ''
    return
  }

  urlValidationStatus.value = 'checking'
  // 防抖验证
  setTimeout(() => {
    const validation = validateGitUrl(newUrl)
    urlValidationStatus.value = validation.valid ? 'valid' : 'invalid'
    urlValidationMessage.value = validation.message
  }, 300)
})

// 处理Git对话框关闭
const handleGitDialogClose = (done: () => void) => {
  if (installingFromGit.value) {
    ElMessageBox.confirm('插件正在安装中，确定要取消吗？', '取消安装', {
      confirmButtonText: '确定',
      cancelButtonText: '继续安装',
      type: 'warning'
    })
      .then(() => {
        resetGitDialog()
        done()
      })
      .catch(() => {
        // 用户选择继续安装
      })
  } else {
    resetGitDialog()
    done()
  }
}

// 重置Git对话框状态
const resetGitDialog = () => {
  gitUrl.value = ''
  urlValidationStatus.value = 'idle'
  urlValidationMessage.value = ''
  gitError.value = null
  installProgress.value = 0
  installProgressMessage.value = ''
  if (gitFormRef.value) {
    gitFormRef.value.resetFields()
  }
}

const installFromGit = async () => {
  // 验证表单
  if (!gitFormRef.value) return
  try {
    await gitFormRef.value.validate()
  } catch (error) {
    return
  }

  const url = gitUrl.value.trim()

  // 重置状态
  gitError.value = null
  installingFromGit.value = true
  installProgress.value = 0
  installProgressMessage.value = '准备安装...'

  try {
    // 更新进度
    installProgress.value = 10
    installProgressMessage.value = '验证Git仓库...'

    // 验证URL格式
    const validation = validateGitUrl(url)
    if (!validation.valid) {
      throw new Error(validation.message)
    }

    // 检查Git是否可用（通过主进程）
    installProgress.value = 20
    installProgressMessage.value = '检查Git环境...'

    // 显示安装开始消息
    ElMessage.info('开始从Git仓库安装插件...')

    // 调用主进程安装插件
    installProgress.value = 30
    installProgressMessage.value = '克隆仓库...'

    const plugin = await window.api.plugins.installPlugin(url)

    // 安装成功
    installProgress.value = 100
    installProgressMessage.value = '安装完成'

    ElMessage.success(`插件 "${plugin.manifest.name}" 安装成功`)

    // 延迟后关闭对话框，让用户看到成功消息
    setTimeout(() => {
      gitDialogVisible.value = false
      resetGitDialog()

      // 将新插件添加到列表
      plugins.value.push(plugin)

      // 如果启用了自动检查更新，刷新插件列表
      if (autoCheckUpdates.value) {
        setTimeout(() => {
          refreshPlugins()
        }, 1000)
      }
    }, 1000)
  } catch (error: any) {
    console.error('从Git仓库安装插件失败:', error)

    // 根据错误类型分类
    let errorTitle = '安装失败'
    let errorMessage = error.message || '未知错误'

    // 错误类型分类
    if (error.message.includes('Git未安装') || error.message.includes('不在PATH中')) {
      errorTitle = 'Git未安装'
      errorMessage = 'Git未安装或不在系统PATH中。请安装Git并确保可以在命令行中运行git命令。'
    } else if (error.message.includes('克隆失败') || error.message.includes('clone')) {
      errorTitle = '克隆仓库失败'
      errorMessage = '无法克隆Git仓库。请检查仓库URL是否有效，以及您是否有访问权限。'
    } else if (error.message.includes('无法解析插件清单')) {
      errorTitle = '无效的插件'
      errorMessage = '仓库中没有找到有效的plugin.json文件。请确保这是一个有效的Entity Manager插件。'
    } else if (
      error.message.includes('网络') ||
      error.message.includes('连接') ||
      error.message.includes('timeout')
    ) {
      errorTitle = '网络错误'
      errorMessage = '无法连接到Git仓库。请检查网络连接和仓库URL。'
    } else if (error.message.includes('权限') || error.message.includes('认证')) {
      errorTitle = '权限错误'
      errorMessage = '没有权限访问该仓库。对于私有仓库，请使用SSH密钥或访问令牌。'
    }

    gitError.value = {
      title: errorTitle,
      message: errorMessage
    }

    installProgress.value = 0
    installProgressMessage.value = '安装失败'

    // 滚动到错误信息
    setTimeout(() => {
      const errorElement = document.querySelector('.error-message')
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  } finally {
    installingFromGit.value = false
  }
}

// 处理更新对话框关闭
const handleUpdatesDialogClose = (done: () => void) => {
  if (updatingPlugins.value.size > 0) {
    ElMessageBox.confirm('有插件正在更新中，确定要关闭对话框吗？', '关闭更新对话框', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(() => {
        done()
      })
      .catch(() => {
        // 用户选择取消关闭
      })
  } else {
    done()
  }
}

// 检查插件更新
const checkForUpdates = async () => {
  checkingUpdates.value = true
  try {
    const updates = await window.api.plugins.checkUpdates()
    availableUpdates.value = updates

    if (updates.length === 0) {
      ElMessage.success('所有插件都是最新版本')
    } else {
      updatesDialogVisible.value = true
      ElMessage.info(`发现 ${updates.length} 个插件有更新`)
    }
  } catch (error) {
    console.error('检查更新失败:', error)
    ElMessage.error('检查更新失败: ' + (error instanceof Error ? error.message : String(error)))
  } finally {
    checkingUpdates.value = false
  }
}

// 更新单个插件
const updatePlugin = async (pluginId: string) => {
  updatingPlugins.value.add(pluginId)
  try {
    ElMessage.info(`正在更新插件 ${pluginId}...`)

    // 调用主进程更新插件
    const result = await window.api.plugins.updatePlugin(pluginId)

    if (result) {
      ElMessage.success(`插件 ${pluginId} 更新成功`)

      // 从更新列表中移除
      availableUpdates.value = availableUpdates.value.filter((u) => u.pluginId !== pluginId)

      // 刷新插件列表以获取新版本
      await fetchPlugins()
    } else {
      ElMessage.error(`插件 ${pluginId} 更新失败`)
    }
  } catch (error) {
    console.error(`更新插件 ${pluginId} 失败:`, error)
    ElMessage.error(`更新失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    updatingPlugins.value.delete(pluginId)
  }
}

// 批量更新所有插件
const updateAllPlugins = async () => {
  if (availableUpdates.value.length === 0) return

  const pluginIds = availableUpdates.value.map((u) => u.pluginId)
  let successCount = 0
  let failCount = 0

  for (const pluginId of pluginIds) {
    try {
      await updatePlugin(pluginId)
      successCount++
    } catch {
      failCount++
    }
  }

  if (failCount === 0) {
    ElMessage.success(`所有插件更新完成 (${successCount} 个成功)`)
    updatesDialogVisible.value = false
  } else {
    ElMessage.warning(`更新完成: ${successCount} 个成功, ${failCount} 个失败`)
  }
}

const refreshPlugins = async () => {
  await fetchPlugins()
  ElMessage.success('插件列表已刷新')
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

// 初始化加载数据
onMounted(() => {
  fetchPlugins()
})
</script>

<style scoped lang="scss">
.plugins-view {
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

  .plugins-controls {
    margin-bottom: 24px;

    .filter-buttons {
      display: flex;
      justify-content: center;
    }

    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  }

  .plugins-content {
    flex: 1;
    display: flex;
    flex-direction: column;

    .plugins-tabs {
      flex: 1;
      display: flex;
      flex-direction: column;

      :deep(.el-tabs__content) {
        flex: 1;
        overflow: auto;
      }
    }

    .plugins-grid {
      .plugin-card {
        border: 1px solid var(--el-border-color);
        background-color: var(--el-bg-color);
        margin-bottom: 16px;

        .plugin-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;

          .plugin-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background-color: rgba(138, 109, 247, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;

            .el-icon {
              font-size: 24px;
              color: #8a6df7;
            }
          }

          .plugin-title {
            flex: 1;

            h4 {
              margin: 0 0 4px 0;
              font-size: 16px;
              color: var(--el-text-color-primary);
            }

            .plugin-meta {
              display: flex;
              align-items: center;
              gap: 8px;

              .plugin-version {
                font-size: 12px;
                color: var(--el-text-color-secondary);
              }
            }
          }
        }

        .plugin-description {
          color: var(--el-text-color-regular);
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 12px;
          min-height: 40px;
        }

        .plugin-info {
          .info-item {
            display: flex;
            align-items: center;
            margin-bottom: 6px;

            .info-label {
              width: 60px;
              font-size: 12px;
              color: var(--el-text-color-secondary);
            }

            .info-value {
              flex: 1;
              font-size: 12px;
              color: var(--el-text-color-regular);
            }
          }
        }

        .plugin-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--el-border-color-light);
        }
      }
    }

    .market-placeholder {
      height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;

      .placeholder-content {
        text-align: center;

        h3 {
          margin: 16px 0 8px 0;
          color: var(--el-text-color-primary);
        }

        p {
          margin: 0 0 16px 0;
          color: var(--el-text-color-secondary);
        }
      }
    }

    .dev-tools {
      .dev-section {
        margin-bottom: 32px;

        h3 {
          margin: 0 0 8px 0;
          color: var(--el-text-color-primary);
        }

        p {
          margin: 0 0 16px 0;
          color: var(--el-text-color-secondary);
        }

        .dev-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }

        .template-grid {
          .template-card {
            border: 1px solid var(--el-border-color);
            background-color: var(--el-bg-color);

            .template-header {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 12px;

              .el-icon {
                font-size: 24px;
                color: #8a6df7;
              }

              h4 {
                margin: 0;
                font-size: 16px;
                color: var(--el-text-color-primary);
              }
            }

            p {
              color: var(--el-text-color-regular);
              font-size: 13px;
              line-height: 1.5;
              margin-bottom: 12px;
              min-height: 40px;
            }
          }
        }
      }
    }
  }

  .plugin-detail {
    .detail-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;

      .detail-icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background-color: rgba(138, 109, 247, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;

        .el-icon {
          font-size: 32px;
          color: #8a6df7;
        }
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

          .detail-version {
            font-size: 14px;
            color: var(--el-text-color-secondary);
          }
        }
      }
    }

    .detail-description {
      color: var(--el-text-color-regular);
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 16px;
    }

    .detail-info {
      .info-row {
        display: flex;
        margin-bottom: 12px;

        .info-label {
          width: 80px;
          font-size: 13px;
          color: var(--el-text-color-secondary);
        }

        .info-value {
          flex: 1;
          font-size: 13px;
          color: var(--el-text-color-regular);
        }
      }
    }

    .detail-actions {
      display: flex;
      align-items: center;
      padding-top: 16px;
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

  .empty-config {
    text-align: center;
    padding: 60px 20px;
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

  .field-label {
    display: flex;
    align-items: center;
  }

  .unsupported-type {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  /* Git安装对话框样式 */
  .git-install-dialog {
    .validation-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;

      .loading-icon {
        animation: rotate 1.5s linear infinite;
      }

      .validation-message {
        font-size: 13px;
        color: var(--el-text-color-regular);
      }
    }

    .installation-instructions {
      background-color: var(--el-bg-color-page);
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;

      .instruction-text {
        margin: 0 0 8px 0;
        font-size: 13px;
        color: var(--el-text-color-secondary);

        &:last-child {
          margin-bottom: 0;
        }
      }

      .instruction-list {
        margin: 8px 0 12px 20px;
        padding: 0;

        li {
          font-size: 12px;
          color: var(--el-text-color-regular);
          margin-bottom: 4px;

          code {
            background-color: var(--el-bg-color);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 11px;
          }
        }
      }
    }

    .error-message {
      margin-top: 16px;
    }

    .installation-progress {
      margin-top: 20px;

      .progress-text {
        text-align: center;
        margin-top: 8px;
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  /* 仓库链接样式 */
  .repository-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--el-color-primary);
    text-decoration: none;
    font-size: 13px;

    &:hover {
      text-decoration: underline;
      color: var(--el-color-primary-light-3);
    }

    .el-icon {
      font-size: 12px;
    }
  }

  /* 更新对话框样式 */
  .updates-dialog {
    .no-updates {
      text-align: center;
      padding: 40px 20px;

      .el-icon {
        margin-bottom: 16px;
      }

      h3 {
        margin: 0 0 8px 0;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 0;
        color: var(--el-text-color-secondary);
      }
    }

    .updates-summary {
      margin: 0 0 16px 0;
      color: var(--el-text-color-regular);
      font-size: 14px;
    }

    .version-comparison {
      display: flex;
      align-items: center;
      gap: 8px;

      .current-version {
        color: var(--el-text-color-secondary);
        text-decoration: line-through;
        font-size: 12px;
      }

      .el-icon {
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }

      .latest-version {
        color: var(--el-color-success);
        font-weight: 500;
        font-size: 12px;
      }
    }
  }
}
</style>
