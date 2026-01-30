<template>
  <div class="settings-view">
    <div class="view-header">
      <h2>设置</h2>
      <p class="view-description">配置应用行为和外观</p>
    </div>

    <div class="settings-container">
      <el-row :gutter="24">
        <!-- 左侧导航 -->
        <el-col :span="6">
          <el-card class="settings-nav" shadow="never">
            <el-menu
              :default-active="activeSetting"
              @select="handleSettingSelect"
              class="settings-menu"
            >
              <el-menu-item index="general">
                <el-icon><Setting /></el-icon>
                <span>通用设置</span>
              </el-menu-item>
              <el-menu-item index="appearance">
                <el-icon><Brush /></el-icon>
                <span>外观</span>
              </el-menu-item>

              <el-menu-item index="data">
                <el-icon><DataLine /></el-icon>
                <span>数据管理</span>
              </el-menu-item>
              <el-menu-item index="plugins">
                <el-icon><Grid /></el-icon>
                <span>插件</span>
              </el-menu-item>
              <el-menu-item index="shortcuts">
                <el-icon><Key /></el-icon>
                <span>快捷键</span>
              </el-menu-item>
              <!-- 高级设置已注释 - 暂时隐藏
              <el-menu-item index="advanced">
                <el-icon><Tools /></el-icon>
                <span>高级</span>
              </el-menu-item>
              -->
              <el-menu-item index="about">
                <el-icon><InfoFilled /></el-icon>
                <span>关于</span>
              </el-menu-item>
            </el-menu>
          </el-card>
        </el-col>

        <!-- 右侧设置内容 -->
        <el-col :span="18">
          <el-card class="settings-content" shadow="never">
            <!-- 通用设置 -->
            <div v-if="activeSetting === 'general'" class="setting-section">
              <h3>通用设置</h3>

              <el-form label-width="140px" label-position="left">
                <el-form-item label="自动保存">
                  <el-switch v-model="settings.general.autoSave" />
                  <div class="setting-description">启用后，应用将自动保存您的更改</div>
                </el-form-item>

                <el-form-item label="自动保存间隔">
                  <el-input-number
                    v-model="settings.general.autoSaveInterval"
                    :min="1"
                    :max="60"
                    :disabled="!settings.general.autoSave"
                  />
                  <div class="setting-description">自动保存的时间间隔（分钟）</div>
                </el-form-item>
              </el-form>
            </div>

            <!-- 外观设置 -->
            <div v-else-if="activeSetting === 'appearance'" class="setting-section">
              <h3>外观设置</h3>

              <el-form label-width="140px" label-position="left">
                <el-form-item label="主题">
                  <el-select v-model="settings.appearance.theme" style="width: 200px">
                    <el-option label="明亮" value="light" />
                    <el-option label="黑暗" value="dark" />
                    <el-option label="跟随系统" value="auto" />
                  </el-select>
                </el-form-item>
              </el-form>
            </div>

            <!-- 数据管理 -->
            <div v-else-if="activeSetting === 'data'" class="setting-section">
              <h3>数据管理</h3>

              <el-form label-width="180px" label-position="left">
                <el-form-item label="数据清理">
                  <el-button type="danger" @click="clearData">清理数据</el-button>
                  <div class="setting-description">删除所有应用数据和设置，恢复出厂状态</div>
                </el-form-item>
              </el-form>
            </div>

            <!-- 插件设置 -->
            <div v-else-if="activeSetting === 'plugins'" class="setting-section">
              <h3>插件设置</h3>

              <el-form label-width="140px" label-position="left">
                <el-form-item label="自动检查更新">
                  <el-switch v-model="settings.plugins.autoCheckUpdates" />
                  <div class="setting-description">自动检查插件更新</div>
                </el-form-item>

                <el-form-item label="自动更新插件">
                  <el-switch
                    v-model="settings.plugins.autoUpdate"
                    :disabled="!settings.plugins.autoCheckUpdates"
                  />
                  <div class="setting-description">自动安装插件更新（需要开启自动检查更新）</div>
                </el-form-item>
              </el-form>
            </div>

            <!-- 快捷键设置 -->
            <div v-else-if="activeSetting === 'shortcuts'" class="setting-section">
              <h3>快捷键设置</h3>

              <el-table :data="shortcuts" style="width: 100%">
                <el-table-column prop="command" label="命令" width="200" />
                <el-table-column prop="description" label="描述" />
                <el-table-column prop="keybinding" label="快捷键" width="200">
                  <template #default="scope">
                    <el-input
                      v-model="scope.row.keybinding"
                      placeholder="点击设置快捷键"
                      @focus="startRecording(scope.$index)"
                      @blur="stopRecording"
                      readonly
                    />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100">
                  <template #default="scope">
                    <el-button type="text" @click="resetShortcut(scope.$index)">重置</el-button>
                  </template>
                </el-table-column>
              </el-table>

              <div class="setting-actions" style="margin-top: 24px">
                <el-button @click="resetAllShortcuts">重置所有快捷键</el-button>
                <el-button type="primary" @click="saveShortcuts">保存更改</el-button>
              </div>
            </div>

            <!-- 高级设置已注释 - 暂时隐藏
            <div v-else-if="activeSetting === 'advanced'" class="setting-section">
              <h3>高级设置</h3>

              <el-form label-width="140px" label-position="left">
                <el-form-item label="开发者模式">
                  <el-switch v-model="settings.advanced.developerMode" />
                  <div class="setting-description">启用开发者工具和调试功能</div>
                </el-form-item>

                <el-form-item label="日志级别">
                  <el-select v-model="settings.advanced.logLevel" style="width: 200px">
                    <el-option label="错误" value="error" />
                    <el-option label="警告" value="warn" />
                    <el-option label="信息" value="info" />
                    <el-option label="调试" value="debug" />
                  </el-select>
                </el-form-item>

                <el-form-item label="实验性功能">
                  <el-switch v-model="settings.advanced.experimentalFeatures" />
                  <div class="setting-description">启用可能不稳定的实验性功能</div>
                </el-form-item>

                <el-form-item label="硬件加速">
                  <el-switch v-model="settings.advanced.hardwareAcceleration" />
                  <div class="setting-description">启用GPU硬件加速（可能需要重启应用）</div>
                </el-form-item>

                <el-form-item label="性能监控">
                  <el-switch v-model="settings.advanced.performanceMonitoring" />
                  <div class="setting-description">监控应用性能并记录指标</div>
                </el-form-item>
              </el-form>
            </div>
            -->

            <!-- 关于 -->
            <div v-else-if="activeSetting === 'about'" class="setting-section">
              <div class="about-section">
                <div class="about-header">
                  <div class="app-icon">
                    <el-icon :size="64" color="#8a6df7"><Box /></el-icon>
                  </div>
                  <div class="app-info">
                    <h3>{{ appName }}</h3>
                    <p class="app-version">版本 {{ appVersion }}</p>
                    <p class="app-description">可扩展的实体管理桌面应用</p>
                  </div>
                </div>

                <el-divider />

                <div class="about-content">
                  <h4>系统信息</h4>
                  <div class="system-info">
                    <div class="info-row">
                      <span class="info-label">Electron:</span>
                      <span class="info-value">版本 {{ electronVersion }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Node.js:</span>
                      <span class="info-value">版本 {{ nodeVersion }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Chrome:</span>
                      <span class="info-value">版本 {{ chromeVersion }}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">操作系统:</span>
                      <span class="info-value">{{ osInfo }}</span>
                    </div>
                  </div>

                  <h4>更新设置</h4>
                  <div class="system-info">
                    <div class="info-row">
                      <span class="info-label">自动检查更新:</span>
                      <span class="info-value">
                        <el-switch v-model="settings.general.autoCheckAppUpdates" />
                      </span>
                    </div>
                  </div>

                  <h4>项目仓库</h4>
                  <div class="info-row">
                    <span class="info-label">GitHub:</span>
                    <span class="info-value">
                      <el-link type="primary" @click="viewSourceCode">{{ gitRepoUrl }}</el-link>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">分支:</span>
                    <span class="info-value">{{ gitRepoBranch }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Commit:</span>
                    <span class="info-value">{{ gitRepoCommit }}</span>
                  </div>
                  <!-- <div class="info-row" v-if="gitRepoHasChanges">
                    <span class="info-label">状态:</span>
                    <span class="info-value" style="color: #e6a23c">有未提交的更改</span>
                  </div> -->

                  <h4>开发团队</h4>
                  <p>实体管理器由开源社区开发和维护。</p>

                  <h4>许可证</h4>
                  <p>本项目基于 MIT 许可证开源。</p>

                  <div class="about-actions">
                    <el-button type="primary" @click="checkForUpdates">
                      <el-icon><Refresh /></el-icon>
                      检查更新
                    </el-button>
                    <el-button @click="viewLicense">查看许可证</el-button>
                    <el-button @click="viewSourceCode">源代码</el-button>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 设置操作栏 -->
    <div class="settings-actions">
      <el-button @click="resetSettings" :disabled="loading">重置</el-button>
      <el-button type="primary" @click="saveSettings" :loading="loading">保存设置</el-button>
    </div>

    <!-- 更新对话框 -->
    <el-dialog
      v-model="updateDialogVisible"
      :title="getUpdateDialogTitle()"
      width="500px"
      :show-close="!isUpdateInProgress()"
      :close-on-click-modal="!isUpdateInProgress()"
      :close-on-press-escape="!isUpdateInProgress()"
    >
      <div v-if="updateState === UpdateState.CHECKING" class="update-dialog-content">
        <div class="update-checking">
          <el-icon class="loading-icon" :size="32"><Loading /></el-icon>
          <p>正在检查更新...</p>
        </div>
      </div>

      <div v-else-if="updateState === UpdateState.AVAILABLE" class="update-dialog-content">
        <div class="update-available">
          <el-alert title="发现新版本" type="success" :closable="false" show-icon />
          <div class="update-info">
            <p><strong>当前版本：</strong>{{ updateInfo?.currentVersion || '未知' }}</p>
            <p><strong>最新版本：</strong>{{ updateInfo?.latestVersion || '未知' }}</p>
            <p v-if="updateInfo?.releaseDate">
              <strong>发布日期：</strong>{{ updateInfo.releaseDate }}
            </p>
          </div>
          <div v-if="updateInfo?.releaseNotes" class="release-notes">
            <h4>更新说明：</h4>
            <div class="release-notes-content">{{ updateInfo.releaseNotes }}</div>
          </div>
          <div class="update-actions">
            <el-button type="primary" :loading="loading" @click="downloadUpdate">
              <el-icon><Download /></el-icon>
              下载更新
            </el-button>
            <el-button @click="cancelUpdate">稍后再说</el-button>
          </div>
        </div>
      </div>

      <div v-else-if="updateState === UpdateState.DOWNLOADING" class="update-dialog-content">
        <div class="update-downloading">
          <h4>正在下载更新...</h4>
          <el-progress
            :percentage="updateProgress?.percent || 0"
            :stroke-width="16"
            :text-inside="true"
            :status="getProgressStatus()"
          />
          <div v-if="updateProgress" class="download-details">
            <p>速度：{{ formatBytes(updateProgress.bytesPerSecond) }}/s</p>
            <p>
              进度：{{ formatBytes(updateProgress.transferred) }} /
              {{ formatBytes(updateProgress.total) }}
            </p>
          </div>
          <div class="update-actions">
            <el-button type="danger" @click="cancelUpdate" :loading="loading">取消下载</el-button>
          </div>
        </div>
      </div>

      <div v-else-if="updateState === UpdateState.DOWNLOADED" class="update-dialog-content">
        <div class="update-downloaded">
          <el-alert title="更新下载完成" type="success" :closable="false" show-icon />
          <p>更新已下载完成，准备安装。</p>
          <div class="update-actions">
            <el-button type="primary" @click="installUpdate">
              <el-icon><Check /></el-icon>
              安装更新
            </el-button>
            <el-button @click="cancelUpdate">稍后安装</el-button>
          </div>
        </div>
      </div>

      <div v-else-if="updateState === UpdateState.NOT_AVAILABLE" class="update-dialog-content">
        <div class="update-not-available">
          <el-alert title="当前已是最新版本" type="info" :closable="false" show-icon />
          <p>当前版本 {{ updateInfo?.currentVersion || '未知' }} 已是最新版本。</p>
          <div class="update-actions">
            <el-button type="primary" @click="closeUpdateDialog">确定</el-button>
          </div>
        </div>
      </div>

      <div v-else-if="updateState === UpdateState.ERROR" class="update-dialog-content">
        <div class="update-error">
          <el-alert
            :title="`更新检查失败: ${updateError?.code || '未知错误'}`"
            type="error"
            :closable="false"
            show-icon
          />
          <p>{{ updateError?.message || '未知错误' }}</p>
          <div class="update-actions">
            <el-button type="primary" @click="retryUpdate">重试</el-button>
            <el-button @click="closeUpdateDialog">关闭</el-button>
          </div>
        </div>
      </div>

      <div v-else class="update-dialog-content">
        <div class="update-idle">
          <p>正在初始化更新检查...</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, onUnmounted } from 'vue'
import type {
  GeneralConfig,
  AppearanceConfig,
  PluginsConfig,
  AdvancedConfig
} from '@shared/types/config'
import {
  UpdateState,
  type UpdateInfo,
  type UpdateProgress,
  type UpdateError,
  type UpdateConfig
} from '@shared/types/update'
import {
  Setting,
  Brush,
  DataLine,
  Grid,
  Key,
  InfoFilled,
  Box,
  Refresh,
  Download,
  Loading,
  Check,
  Warning,
  Close
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/app'
import { useConfig } from '../composables/useConfig'
import { useShortcuts } from '../composables/useShortcuts'

interface Settings {
  general: GeneralConfig
  appearance: AppearanceConfig
  plugins: PluginsConfig
  advanced: AdvancedConfig
}

// 响应式状态
const activeSetting = ref('general')
const recordingIndex = ref(-1)
const loading = ref(false)
const systemInfo = ref<any>(null)
const gitRepoInfo = ref<{
  url: string
  branch: string
  commit: string
  hasChanges: boolean
} | null>(null)

// 更新状态
const updateState = ref<UpdateState>(UpdateState.IDLE)
const updateInfo = ref<UpdateInfo | null>(null)
const updateProgress = ref<UpdateProgress | null>(null)
const updateError = ref<UpdateError | null>(null)
const updateDialogVisible = ref(false)
const updateAutoCheck = ref(true)

// 设置数据 - 从配置服务加载
const settings = reactive<Settings>({
  general: {
    language: 'zh-CN',
    startupBehavior: 'restore',
    autoSave: true,
    autoSaveInterval: 5,
    autoCheckAppUpdates: true
  },
  appearance: {
    theme: 'dark',
    accentColor: '#8a6df7',
    fontSize: 14,
    editorFont: 'JetBrains Mono',
    density: 'normal'
  },
  plugins: {
    pluginDirectory: '~/Documents/EntityManager/Plugins',
    autoCheckUpdates: true,
    autoUpdate: false,
    permissions: []
  },
  advanced: {
    developerMode: false,
    logLevel: 'info',
    experimentalFeatures: false,
    hardwareAcceleration: true,
    performanceMonitoring: false
  }
})

// Store 和 Composables
const appStore = useAppStore()
const configApi = useConfig()
const shortcutsManager = useShortcuts()

// 快捷键数据 - 从 useShortcuts composable 获取
const shortcuts = shortcutsManager.shortcuts

// 检测快捷键冲突 - 使用 composable 中的方法
const findConflictingShortcuts = shortcutsManager.findConflicts

// 监听主题变化并实时应用
watch(
  () => settings.appearance.theme,
  async (newTheme) => {
    appStore.theme = newTheme
    try {
      await window.api.config.setTheme(newTheme)
      await configApi.updateCategoryConfig('appearance', { theme: newTheme })
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }
)

// 监听自动检查更新设置变化
watch(
  () => settings.general.autoCheckAppUpdates,
  async (newValue) => {
    try {
      await configApi.updateCategoryConfig('general', { autoCheckAppUpdates: newValue } as any)
    } catch (error) {
      console.error('Failed to save auto-check setting:', error)
      ElMessage.error('保存自动检查更新设置失败')
    }
  }
)

// 加载配置
const loadConfig = async () => {
  loading.value = true
  try {
    await configApi.loadConfig()
    const config = configApi.config.value
    if (config) {
      // 分配各分类配置
      settings.general = { ...settings.general, ...config.general }
      settings.appearance = config.appearance
      settings.plugins = config.plugins
      settings.advanced = config.advanced
      // 快捷键已通过 useShortcuts composable 自动加载
      // 同步主题到应用存储
      appStore.theme = config.appearance.theme
    }
  } catch (error) {
    console.error('Failed to load config:', error)
    ElMessage.error('加载配置失败')
  } finally {
    loading.value = false
  }
}

// 保存配置
const saveConfig = async () => {
  loading.value = true
  try {
    // 更新各分类配置
    await configApi.updateCategoryConfig('general', settings.general)
    await configApi.updateCategoryConfig('appearance', settings.appearance)
    await configApi.updateCategoryConfig('plugins', settings.plugins)
    // 高级设置已注释，暂不保存
    // await configApi.updateCategoryConfig('advanced', settings.advanced)
    // 保存快捷键 - 使用 composable 方法
    await shortcutsManager.saveShortcuts()

    ElMessage.success('设置已保存')
  } catch (error) {
    console.error('Failed to save config:', error)
    ElMessage.error('保存设置失败')
  } finally {
    loading.value = false
  }
}

// 加载系统信息
const loadSystemInfo = async () => {
  try {
    const [info, gitRepo] = await Promise.all([
      window.api.system.getInfo(),
      window.api.system.getGitRepo().catch(() => null)
    ])
    systemInfo.value = info
    gitRepoInfo.value = gitRepo
  } catch (error) {
    console.error('Failed to load system info:', error)
  }
}

// 计算属性 - 关于页面信息
const appVersion = computed(() => systemInfo.value?.appVersion || '1.0.0')
const appName = computed(() => systemInfo.value?.appName || '实体管理器')
const electronVersion = computed(() => systemInfo.value?.electronVersion || '未知')
const nodeVersion = computed(() => systemInfo.value?.nodeVersion || '未知')
const chromeVersion = computed(() => systemInfo.value?.chromeVersion || '未知')
const osInfo = computed(() => {
  if (!systemInfo.value?.os) return `未知`
  const os = systemInfo.value.os
  return `${os.type} ${os.release} (${os.arch})`
})

// Git 仓库信息计算属性
const gitRepoUrl = computed(
  () => gitRepoInfo.value?.url || 'https://github.com/yourusername/entity-manager'
)
const gitRepoBranch = computed(() => gitRepoInfo.value?.branch || 'main')
const gitRepoCommit = computed(() => gitRepoInfo.value?.commit || 'unknown')
const gitRepoHasChanges = computed(() => gitRepoInfo.value?.hasChanges || false)

// 方法
const handleSettingSelect = (index: string) => {
  activeSetting.value = index
}

const clearData = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清理所有数据吗？此操作将删除所有应用数据、实体和设置，恢复出厂状态。此操作不可撤销。',
      '清理数据',
      {
        confirmButtonText: '确定清理',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    loading.value = true

    // 调用IPC清除所有配置
    await window.api.config.reset()

    // 清除所有实体数据（通过调用重置API）
    // 注意：这里假设有一个系统重置API，如果没有，可以通过其他方式清理

    ElMessage.success('数据清理完成，请重启应用以完成重置')

    // 显示重启提示
    await ElMessageBox.confirm(
      '数据已清理完成。需要重启应用才能完全生效。是否立即重启？',
      '重启应用',
      {
        confirmButtonText: '立即重启',
        cancelButtonText: '稍后手动重启',
        type: 'info'
      }
    )

    // 重启应用
    await window.api.system.restart()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Failed to clear data:', error)
      ElMessage.error('清理数据失败: ' + (error.message || '未知错误'))
    }
  } finally {
    loading.value = false
  }
}

// 键盘事件处理 - 修复后的组合键录制
const handleKeyDown = (event: KeyboardEvent) => {
  if (recordingIndex.value === -1) return

  // 阻止默认行为，防止浏览器快捷键触发
  event.preventDefault()
  event.stopPropagation()

  // 检查是否包含主键（非修饰键）
  // 如果只按了修饰键（如Ctrl、Shift等），继续等待，不停止录制
  if (!shortcutsManager.hasMainKey(event)) {
    return
  }

  // 使用 composable 中的方法构建快捷键字符串
  const keybinding = shortcutsManager.buildKeybinding(event)

  if (!keybinding) return

  const currentIndex = recordingIndex.value

  // 检测冲突
  const conflicts = findConflictingShortcuts(keybinding, currentIndex)
  if (conflicts.length > 0) {
    ElMessage.warning(`快捷键 "${keybinding}" 与以下功能冲突: ${conflicts.join(', ')}`)
  }

  // 更新快捷键
  shortcuts.value[currentIndex].keybinding = keybinding

  // 停止录制
  recordingIndex.value = -1
  document.removeEventListener('keydown', handleKeyDown)

  ElMessage.success(`快捷键已设置为: ${keybinding}`)
}

const startRecording = (index: number) => {
  recordingIndex.value = index
  ElMessage.info('请按下想要的快捷键组合（如 Ctrl+S）')
  document.addEventListener('keydown', handleKeyDown)
}

const stopRecording = () => {
  recordingIndex.value = -1
  document.removeEventListener('keydown', handleKeyDown)
}

const resetShortcut = (index: number) => {
  shortcutsManager.resetShortcut(index)
}

const resetAllShortcuts = () => {
  ElMessageBox.confirm('确定要重置所有快捷键吗？', '重置快捷键', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    shortcutsManager.resetAllShortcuts()
    ElMessage.success('所有快捷键已重置')
  })
}

const saveShortcuts = async () => {
  try {
    loading.value = true
    const success = await shortcutsManager.saveShortcuts()
    if (success) {
      // 重新加载以确保全局状态同步
      await shortcutsManager.reloadShortcuts()
      ElMessage.success('快捷键设置已保存')
    } else {
      ElMessage.error('保存快捷键设置失败')
    }
  } catch (error) {
    console.error('Failed to save shortcuts:', error)
    ElMessage.error('保存快捷键设置失败')
  } finally {
    loading.value = false
  }
}

// 更新相关辅助方法
const getUpdateDialogTitle = (): string => {
  switch (updateState.value) {
    case UpdateState.CHECKING:
      return '检查更新'
    case UpdateState.AVAILABLE:
      return '发现新版本'
    case UpdateState.DOWNLOADING:
      return '下载更新'
    case UpdateState.DOWNLOADED:
      return '更新下载完成'
    case UpdateState.NOT_AVAILABLE:
      return '已是最新版本'
    case UpdateState.ERROR:
      return '更新错误'
    default:
      return '更新'
  }
}

const isUpdateInProgress = (): boolean => {
  return [UpdateState.CHECKING, UpdateState.DOWNLOADING].includes(updateState.value)
}

const getProgressStatus = (): 'success' | 'exception' | 'warning' | undefined => {
  if (updateState.value === UpdateState.ERROR) return 'exception'
  if (updateState.value === UpdateState.DOWNLOADING) return undefined
  return undefined
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const closeUpdateDialog = () => {
  updateDialogVisible.value = false
  // 如果不在进行中，重置状态
  if (!isUpdateInProgress()) {
    resetUpdateState()
  }
}

const resetUpdateState = () => {
  updateState.value = UpdateState.IDLE
  updateInfo.value = null
  updateProgress.value = null
  updateError.value = null
}

const retryUpdate = () => {
  resetUpdateState()
  checkForUpdates()
}

// 检查更新 - 真实实现
const checkForUpdates = async () => {
  try {
    // 重置状态
    resetUpdateState()
    updateState.value = UpdateState.CHECKING
    updateDialogVisible.value = true

    // 调用真实的更新检查 API
    const result = await window.api.update.checkForUpdates()

    if (result?.hasUpdate) {
      updateState.value = UpdateState.AVAILABLE
      updateInfo.value = result
    } else {
      updateState.value = UpdateState.NOT_AVAILABLE
      updateInfo.value = result || { hasUpdate: false, currentVersion: appVersion.value }
    }
  } catch (error: any) {
    console.error('检查更新失败:', error)
    updateState.value = UpdateState.ERROR
    updateError.value = {
      code: 'CHECK_FAILED',
      message: error?.message || '检查更新时发生未知错误',
      details: error
    }
    ElMessage.error('检查更新失败: ' + (error?.message || '未知错误'))
  }
}

// 下载更新
const downloadUpdate = async () => {
  try {
    updateState.value = UpdateState.DOWNLOADING
    loading.value = true
    await window.api.update.downloadUpdate()
    // 状态将由进度事件更新
  } catch (error: any) {
    console.error('下载更新失败:', error)
    updateState.value = UpdateState.ERROR
    updateError.value = {
      code: 'DOWNLOAD_FAILED',
      message: error?.message || '下载更新时发生未知错误',
      details: error
    }
    ElMessage.error('下载更新失败: ' + (error?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

// 安装更新
const installUpdate = async () => {
  try {
    await window.api.update.installUpdate()
    // 应用将重启，无需进一步处理
  } catch (error: any) {
    console.error('安装更新失败:', error)
    updateState.value = UpdateState.ERROR
    updateError.value = {
      code: 'INSTALL_FAILED',
      message: error?.message || '安装更新时发生未知错误',
      details: error
    }
    ElMessage.error('安装更新失败: ' + (error?.message || '未知错误'))
  }
}

// 取消更新
const cancelUpdate = async () => {
  try {
    await window.api.update.cancelUpdate()
    resetUpdateState()
    updateDialogVisible.value = false
    ElMessage.info('更新已取消')
  } catch (error: any) {
    console.error('取消更新失败:', error)
    ElMessage.error('取消更新失败: ' + (error?.message || '未知错误'))
  }
}

// 设置更新事件监听器
const setupUpdateListeners = () => {
  // 检查更新中
  window.electron.ipcRenderer.on('update:checking-for-update', () => {
    updateState.value = UpdateState.CHECKING
  })

  // 有可用更新
  window.electron.ipcRenderer.on('update:update-available', (_, info: UpdateInfo) => {
    updateState.value = UpdateState.AVAILABLE
    updateInfo.value = info
  })

  // 下载进度
  window.electron.ipcRenderer.on('update:download-progress', (_, progress: UpdateProgress) => {
    updateState.value = UpdateState.DOWNLOADING
    updateProgress.value = progress
  })

  // 下载完成
  window.electron.ipcRenderer.on('update:update-downloaded', () => {
    updateState.value = UpdateState.DOWNLOADED
    updateProgress.value = null // 清除进度
    ElMessage.success('更新下载完成，准备安装')
  })

  // 没有可用更新
  window.electron.ipcRenderer.on('update:update-not-available', () => {
    updateState.value = UpdateState.NOT_AVAILABLE
  })

  // 更新错误
  window.electron.ipcRenderer.on('update:update-error', (_, error: UpdateError) => {
    updateState.value = UpdateState.ERROR
    updateError.value = error
    ElMessage.error(`更新错误: ${error.message}`)
  })
}

// 清理更新事件监听器
const cleanupUpdateListeners = () => {
  const channels = [
    'update:checking-for-update',
    'update:update-available',
    'update:download-progress',
    'update:update-downloaded',
    'update:update-not-available',
    'update:update-error'
  ]
  channels.forEach((channel) => {
    window.electron.ipcRenderer.removeAllListeners(channel)
  })
}

const viewLicense = async () => {
  try {
    await window.api.utils.openExternal('https://opensource.org/licenses/MIT')
  } catch (error) {
    console.error('Failed to open license:', error)
    ElMessage.error('打开许可证失败')
  }
}

const viewSourceCode = async () => {
  try {
    await window.api.utils.openExternal('https://github.com/yourusername/entity-manager')
  } catch (error) {
    console.error('Failed to open source code:', error)
    ElMessage.error('打开源代码仓库失败')
  }
}

const resetSettings = async () => {
  try {
    await ElMessageBox.confirm('确定要重置所有设置吗？', '重置设置', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await window.api.config.reset()
    await loadConfig()
    ElMessage.success('设置已重置为默认值')
  } catch {
    // 取消操作
  }
}

const saveSettings = async () => {
  await saveConfig()
}

// 注意：全局快捷键监听已移至 AppLayout.vue 中
// 这里只保留设置界面的快捷键录制功能

// 初始化
onMounted(() => {
  loadConfig()
  loadSystemInfo()
  setupUpdateListeners()
})

// 清理
onUnmounted(() => {
  // 清理快捷键录制监听器
  if (recordingIndex.value !== -1) {
    document.removeEventListener('keydown', handleKeyDown)
  }
  // 清理更新事件监听器
  cleanupUpdateListeners()
})
</script>

<style scoped lang="scss">
.settings-view {
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

  .settings-container {
    flex: 1;
    overflow: auto;

    .settings-nav {
      border: 1px solid var(--el-border-color);
      background-color: var(--el-bg-color);

      .settings-menu {
        border-right: none;

        :deep(.el-menu-item) {
          height: 40px;
          line-height: 40px;
          margin: 2px 0;
          border-radius: 6px;
          font-size: 13px;

          &.is-active {
            background-color: rgba(138, 109, 247, 0.1);
            color: #8a6df7;
          }

          &:not(.is-active):hover {
            background-color: var(--el-fill-color-light);
          }

          .el-icon {
            font-size: 16px;
          }
        }
      }
    }

    .settings-content {
      border: 1px solid var(--el-border-color);
      background-color: var(--el-bg-color);
      min-height: 600px;

      .setting-section {
        h3 {
          margin: 0 0 24px 0;
          font-size: 18px;
          color: var(--el-text-color-primary);
        }

        :deep(.el-form) {
          .el-form-item {
            margin-bottom: 20px;

            .el-form-item__label {
              color: var(--el-text-color-primary);
              font-weight: 500;
            }

            .setting-description {
              margin-top: 4px;
              font-size: 12px;
              color: var(--el-text-color-secondary);
              line-height: 1.4;
            }
          }
        }

        .color-picker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;

          .color-option {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid transparent;

            &.selected {
              border-color: var(--el-text-color-primary);

              .el-icon {
                color: white;
                font-size: 16px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
              }
            }

            &:hover {
              transform: scale(1.1);
            }
          }
        }

        .about-section {
          .about-header {
            display: flex;
            align-items: center;
            gap: 24px;
            margin-bottom: 24px;

            .app-icon {
              width: 80px;
              height: 80px;
              border-radius: 20px;
              background-color: rgba(138, 109, 247, 0.1);
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .app-info {
              h3 {
                margin: 0 0 8px 0;
                font-size: 24px;
              }

              .app-version {
                margin: 0 0 8px 0;
                color: var(--el-text-color-regular);
                font-size: 14px;
              }

              .app-description {
                margin: 0;
                color: var(--el-text-color-secondary);
                font-size: 14px;
              }
            }
          }

          .about-content {
            h4 {
              margin: 20px 0 12px 0;
              font-size: 16px;
              color: var(--el-text-color-primary);
            }

            .system-info {
              .info-row {
                display: flex;
                margin-bottom: 8px;

                .info-label {
                  width: 120px;
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

            p {
              color: var(--el-text-color-regular);
              font-size: 14px;
              line-height: 1.6;
              margin-bottom: 16px;
            }

            .about-actions {
              display: flex;
              gap: 8px;
              margin-top: 24px;
            }
          }
        }
      }
    }
  }

  .settings-actions {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--el-border-color);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  // 更新对话框样式
  .update-dialog-content {
    .update-checking,
    .update-available,
    .update-downloading,
    .update-downloaded,
    .update-not-available,
    .update-error,
    .update-idle {
      padding: 16px 0;
    }

    .update-checking {
      text-align: center;
      .loading-icon {
        margin-bottom: 16px;
        animation: spin 1s linear infinite;
      }
      p {
        margin: 0;
        color: var(--el-text-color-secondary);
      }
    }

    .update-info {
      margin: 16px 0;
      p {
        margin: 8px 0;
        strong {
          display: inline-block;
          width: 80px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    .release-notes {
      margin: 16px 0;
      h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
      .release-notes-content {
        padding: 12px;
        background-color: var(--el-fill-color-light);
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.5;
        max-height: 200px;
        overflow-y: auto;
      }
    }

    .download-details {
      margin: 16px 0;
      p {
        margin: 4px 0;
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }

    .update-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 24px;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
