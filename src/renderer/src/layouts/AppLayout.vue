<template>
  <div class="app-layout">
    <!-- 顶部菜单栏 -->
    <header class="app-header">
      <div class="app-title">
        <span class="app-name">实体管理器</span>
        <span class="app-subtitle">Entity Manager</span>
      </div>

      <div class="app-menu">
        <el-menu
          mode="horizontal"
          :background-color="headerBg"
          :text-color="headerText"
          :active-text-color="primaryColor"
          class="horizontal-menu"
        >
          <el-sub-menu index="1">
            <template #title>文件</template>
            <el-menu-item index="1-1" @click="handleNewFile">新建</el-menu-item>
            <el-menu-item index="1-2" @click="handleOpenFile">打开</el-menu-item>
            <el-menu-item index="1-3" disabled>---</el-menu-item>
            <el-menu-item index="1-4" @click="handleSaveFile">保存</el-menu-item>
            <el-menu-item index="1-5" @click="handleSaveAs">另存为</el-menu-item>
            <el-menu-item index="1-6" disabled>---</el-menu-item>
            <el-menu-item index="1-7" @click="handleImportFile">导入</el-menu-item>
            <el-menu-item index="1-8" @click="handleExportFile">导出</el-menu-item>
            <el-menu-item index="1-9" disabled>---</el-menu-item>
            <el-menu-item index="1-10" @click="handleExit">退出</el-menu-item>
          </el-sub-menu>

          <!-- <el-sub-menu index="2">
            <template #title>编辑</template>
            <el-menu-item index="2-1">撤销</el-menu-item>
            <el-menu-item index="2-2">重做</el-menu-item>
            <el-menu-item index="2-3" disabled>---</el-menu-item>
            <el-menu-item index="2-4">复制</el-menu-item>
            <el-menu-item index="2-5">粘贴</el-menu-item>
            <el-menu-item index="2-6">删除</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="3">
            <template #title>视图</template>
            <el-menu-item index="3-1">切换侧边栏</el-menu-item>
            <el-menu-item index="3-2">重置布局</el-menu-item>
            <el-menu-item index="3-3" disabled>---</el-menu-item>
            <el-menu-item index="3-4">放大</el-menu-item>
            <el-menu-item index="3-5">缩小</el-menu-item>
            <el-menu-item index="3-6">重置缩放</el-menu-item>
          </el-sub-menu> -->

          <el-sub-menu index="4">
            <template #title>插件</template>
            <el-menu-item index="4-1" @click="switchToPlugin">管理插件</el-menu-item>
            <el-menu-item index="4-2" @click="installPlugin">安装插件</el-menu-item>
            <!-- <el-menu-item index="4-3" disabled>---</el-menu-item> -->
            <!-- <el-menu-item index="4-4">开发者工具</el-menu-item> -->
          </el-sub-menu>

          <!-- <el-sub-menu index="5">
            <template #title>帮助</template>
            <el-menu-item index="5-1">文档</el-menu-item>
            <el-menu-item index="5-2">快捷键</el-menu-item>
            <el-menu-item index="5-3" disabled>---</el-menu-item>
            <el-menu-item index="5-4">关于</el-menu-item>
          </el-sub-menu> -->
        </el-menu>
      </div>

      <div class="app-actions">
        <el-button type="text" size="small" @click="toggleSidebar">
          <el-icon :size="18">
            <Menu />
          </el-icon>
        </el-button>
      </div>
    </header>

    <!-- 主内容区域 -->
    <div class="app-main">
      <!-- 左侧边栏 -->
      <aside class="app-sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="sidebar-header">
          <h3 v-if="!sidebarCollapsed">导航</h3>
          <el-tooltip v-else content="展开侧边栏" placement="right">
            <el-button type="text" @click="toggleSidebar">
              <el-icon><Expand /></el-icon>
            </el-button>
          </el-tooltip>
        </div>

        <el-menu
          :default-active="activeMenu"
          :collapse="sidebarCollapsed"
          :background-color="sidebarBg"
          :text-color="sidebarText"
          :active-text-color="primaryColor"
          class="vertical-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="entities">
            <el-icon><List /></el-icon>
            <span class="menu-item-content">
              <span class="menu-title">实体管理</span>
              <el-tag v-if="!sidebarCollapsed" size="small" type="info" class="menu-badge">{{
                entityCount
              }}</el-tag>
            </span>
          </el-menu-item>

          <el-menu-item index="dashboards">
            <el-icon><DataAnalysis /></el-icon>
            <span class="menu-item-content">
              <span class="menu-title">数据看板</span>
            </span>
          </el-menu-item>

          <el-menu-item index="plugins">
            <el-icon><Grid /></el-icon>
            <span class="menu-item-content">
              <span class="menu-title">插件管理</span>
              <el-tag v-if="!sidebarCollapsed" size="small" type="success" class="menu-badge">{{
                pluginCount
              }}</el-tag>
            </span>
          </el-menu-item>

          <el-menu-item index="settings">
            <el-icon><Setting /></el-icon>
            <span class="menu-item-content">
              <span class="menu-title">设置</span>
            </span>
          </el-menu-item>
        </el-menu>

        <div class="sidebar-footer" v-if="!sidebarCollapsed">
          <div class="storage-info">
            <el-progress
              :percentage="storagePercentage"
              :stroke-width="4"
              :show-text="false"
              :color="primaryColor"
            />
            <small>存储使用: {{ usedStorage }} / {{ totalStorage }}</small>
          </div>
        </div>
      </aside>

      <!-- 主工作区 -->
      <main class="app-content">
        <div class="content-toolbar">
          <div class="toolbar-left">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item>首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="activeMenu === 'entities'">实体管理</el-breadcrumb-item>
              <el-breadcrumb-item v-if="activeMenu === 'dashboards'">数据看板</el-breadcrumb-item>
              <el-breadcrumb-item v-if="activeMenu === 'plugins'">插件管理</el-breadcrumb-item>
              <el-breadcrumb-item v-if="activeMenu === 'settings'">设置</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <!-- <div class="toolbar-right">
            <el-input
              v-model="searchQuery"
              placeholder="搜索..."
              size="small"
              class="search-input"
              style="width: 200px; margin-right: 10px"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" size="small">
              <el-icon><Plus /></el-icon>
              新建
            </el-button>
          </div> -->
        </div>

        <div class="content-main">
          <router-view />
        </div>
      </main>
    </div>

    <!-- 底部状态栏 -->
    <footer class="app-footer">
      <div class="status-left">
        <span class="status-item">
          <el-icon><Check /></el-icon>
          就绪
        </span>
        <span class="status-divider">|</span>
        <span class="status-item">
          实体: <strong>{{ entityCount }}</strong>
        </span>
        <span class="status-divider">|</span>
        <span class="status-item">
          插件: <strong>{{ pluginCount }}</strong> 个已加载
        </span>
      </div>
      <div class="status-center">
        <span class="status-item" v-if="selectedCount > 0"> 已选中 {{ selectedCount }} 项 </span>
      </div>
      <div class="status-right">
        <span class="status-item">
          <el-icon><Cpu /></el-icon>
          内存: {{ memoryUsage }}MB
        </span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useShortcuts } from '../composables/useShortcuts'
import { ElMessage } from 'element-plus'
import {
  Menu,
  Expand,
  List,
  DataAnalysis,
  Grid,
  Setting,
  Search,
  Plus,
  Check,
  Cpu
} from '@element-plus/icons-vue'

// Store
const store = useAppStore()
const router = useRouter()
const shortcutsManager = useShortcuts()

// 响应式状态
const sidebarCollapsed = ref(false)
const activeMenu = ref('entities')
const searchQuery = ref('')
const systemStats = ref<any>(null)
const systemInfo = ref<any>(null)

// 模拟数据
const entityCount = computed(() => store.entityCount)
const pluginCount = computed(() => store.pluginCount)
const selectedCount = computed(() => store.selectedCount)

// 使用真实系统数据的计算属性
const usedStorage = computed(() => {
  if (!systemStats.value?.memoryUsage) return '0 MB'
  const usedMB = Math.round(systemStats.value.memoryUsage.rss / 1024 / 1024)
  return `${usedMB} MB`
})

const totalStorage = computed(() => {
  if (!systemInfo.value?.os?.totalMemory) return '0 MB'
  const totalMB = Math.round(systemInfo.value.os.totalMemory / 1024 / 1024)
  return `${totalMB} MB`
})

const memoryUsage = computed(() => {
  if (!systemStats.value?.memoryUsage) return '0'
  return Math.round(systemStats.value.memoryUsage.rss / 1024 / 1024).toString()
})

// 计算属性
const storagePercentage = computed(() => {
  if (!systemStats.value?.memoryUsage || !systemInfo.value?.os?.totalMemory) return 0
  const used = systemStats.value.memoryUsage.rss
  const total = systemInfo.value.os.totalMemory
  return Math.round((used / total) * 100)
})

// 主题颜色
const primaryColor = '#8a6df7'
const headerBg = 'var(--el-bg-color-overlay)'
const headerText = 'var(--el-text-color-primary)'
const sidebarBg = 'var(--el-bg-color)'
const sidebarText = 'var(--el-text-color-primary)'

// 方法
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const handleMenuSelect = (index: string) => {
  activeMenu.value = index
  // 导航到对应路由
  router.push(`/${index}`)
}

const switchToPlugin = () => {
  handleMenuSelect('plugins')
}

const installPlugin = async () => {
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
      ElMessage.success('插件安装成功')
    }
  } catch (error) {
    console.error('Failed to install plugin:', error)
    ElMessage.error('安装失败: ' + (error instanceof Error ? error.message : String(error)))
  }
}

// 文件操作方法
const handleNewFile = async () => {
  try {
    await window.api.files['new']()
    // 重置应用状态
    await store.refreshEntities()
    ElMessage.success('新建文件成功')
  } catch (error) {
    console.error('Failed to create new file:', error)
    ElMessage.error('新建文件失败')
  }
}

const handleOpenFile = async () => {
  try {
    const success = await window.api.files.open()
    if (success) {
      // 刷新实体数据
      await store.refreshEntities()
      ElMessage.success('文件打开成功')
    }
  } catch (error) {
    console.error('Failed to open file:', error)
    ElMessage.error('打开文件失败')
  }
}

const handleSaveFile = async () => {
  try {
    const success = await window.api.files.save()
    if (success) {
      ElMessage.success('文件保存成功')
    } else {
      ElMessage.error('文件保存失败')
    }
  } catch (error) {
    console.error('Failed to save file:', error)
    ElMessage.error('保存文件失败')
  }
}

const handleSaveAs = async () => {
  try {
    const filePath = await window.api.files.saveAs()
    if (filePath) {
      ElMessage.success('文件另存为成功')
    }
  } catch (error) {
    console.error('Failed to save as:', error)
    ElMessage.error('另存为文件失败')
  }
}

const handleImportFile = async () => {
  try {
    // 这里需要先获取文件路径，然后调用导入
    const options = {
      title: '导入文件',
      filters: [{ name: '支持的文件格式', extensions: ['json', 'csv', 'txt'] }],
      properties: ['openFile']
    }
    const result = await window.api.utils.showOpenDialog(options)
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const success = await window.api.files.import(filePath)
      if (success) {
        // 刷新实体数据
        await store.refreshEntities()
        ElMessage.success('文件导入成功')
      } else {
        ElMessage.error('文件导入失败')
      }
    }
  } catch (error) {
    console.error('Failed to import file:', error)
    ElMessage.error('导入文件失败')
  }
}

const handleExportFile = async () => {
  try {
    // 这里需要先获取保存路径，然后调用导出
    const options = {
      title: '导出文件',
      filters: [{ name: 'JSON文件', extensions: ['json'] }],
      defaultPath: 'export.json'
    }
    const result = await window.api.utils.showSaveDialog(options)
    if (!result.canceled && result.filePath) {
      const filePath = result.filePath
      const success = await window.api.files['export'](filePath, 'json')
      if (success) {
        ElMessage.success('文件导出成功')
      } else {
        ElMessage.error('文件导出失败')
      }
    }
  } catch (error) {
    console.error('Failed to export file:', error)
    ElMessage.error('导出文件失败')
  }
}

const handleExit = () => {
  window.api.system.quit()
}

// 加载系统统计信息
const loadSystemStats = async () => {
  try {
    const [stats, info] = await Promise.all([
      window.api.system.getStats(),
      window.api.system.getInfo()
    ])
    systemStats.value = stats
    systemInfo.value = info
  } catch (error) {
    console.error('Failed to load system stats:', error)
  }
}

// 定时器引用
const statsInterval = ref<ReturnType<typeof setInterval> | null>(null)

// 初始化数据
onMounted(async () => {
  try {
    await store.refreshEntities()
    await store.fetchPlugins()
    // 加载系统统计信息
    await loadSystemStats()
    // 先加载快捷键配置，再启用全局监听
    await shortcutsManager.loadShortcuts()
    shortcutsManager.enableGlobalShortcuts()
    // 定期刷新系统统计信息（每5秒）
    statsInterval.value = setInterval(loadSystemStats, 5000)
  } catch (error) {
    console.error('Failed to initialize data:', error)
  }
})

onUnmounted(() => {
  shortcutsManager.disableGlobalShortcuts()
  if (statsInterval.value) {
    clearInterval(statsInterval.value)
  }
})
</script>

<style scoped lang="scss">
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.app-header {
  height: 48px;
  background-color: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  padding: 0 16px;
  user-select: none;
  z-index: 100;

  .app-title {
    display: flex;
    flex-direction: column;
    margin-right: 32px;

    .app-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--el-text-color-primary);
    }

    .app-subtitle {
      font-size: 10px;
      color: var(--el-text-color-secondary);
      opacity: 0.7;
    }
  }

  .app-menu {
    flex: 1;

    .horizontal-menu {
      border-bottom: none;
      height: 48px;

      :deep(.el-sub-menu__title),
      :deep(.el-menu-item) {
        height: 48px;
        line-height: 48px;
        font-size: 13px;
      }
    }
  }

  .app-actions {
    .el-button {
      color: var(--el-text-color-primary);

      &:hover {
        color: v-bind(primaryColor);
      }
    }
  }
}

.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.app-sidebar {
  width: 200px;
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  user-select: none;

  &.collapsed {
    width: calc(var(--el-menu-icon-width) + var(--el-menu-base-level-padding) * 2);

    .sidebar-header {
      display: flex;
      justify-content: center;
      padding: 0;

      h3 {
        display: none;
      }
    }

    .menu-badge {
      display: none;
    }
  }

  .sidebar-header {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid var(--el-border-color-light);

    h3 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .el-button {
      color: var(--el-text-color-secondary);

      &:hover {
        color: v-bind(primaryColor);
      }
    }
  }

  .vertical-menu {
    flex: 1;
    border-right: none;
    padding: 8px 0;

    :deep(.el-menu-item) {
      height: 40px;
      line-height: 40px;
      margin: 2px 8px;
      border-radius: 6px;
      font-size: 13px;

      &.is-active {
        background-color: rgba(138, 109, 247, 0.1);
      }

      &:not(.is-active):hover {
        background-color: var(--el-fill-color-light);
      }

      .menu-item-content {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-left: 8px;
      }

      .menu-title {
        flex: 1;
      }

      .menu-badge {
        position: static;
        transform: none;
        margin-left: 8px;
      }
    }

    :deep(.el-icon) {
      font-size: 16px;
    }
  }

  .sidebar-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--el-border-color-light);

    .storage-info {
      small {
        display: block;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        margin-top: 4px;
      }
    }
  }
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--el-bg-color-page);

  .content-toolbar {
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--el-border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--el-bg-color);

    .toolbar-left {
      :deep(.el-breadcrumb) {
        font-size: 12px;

        .el-breadcrumb__item {
          .el-breadcrumb__inner {
            color: var(--el-text-color-secondary);
            font-weight: 400;
          }

          &:last-child .el-breadcrumb__inner {
            color: var(--el-text-color-primary);
            font-weight: 500;
          }
        }
      }
    }

    .toolbar-right {
      display: flex;
      align-items: center;

      .search-input {
        :deep(.el-input__wrapper) {
          background-color: var(--el-fill-color);
          border-color: var(--el-border-color);

          &:hover {
            border-color: var(--el-border-color-light);
          }
        }
      }
    }
  }

  .content-main {
    flex: 1;
    overflow: auto;
    padding: 16px;
  }
}

.app-footer {
  height: 24px;
  background-color: var(--el-bg-color-overlay);
  border-top: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  user-select: none;

  .status-left,
  .status-center,
  .status-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-divider {
    opacity: 0.3;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;

    .el-icon {
      font-size: 12px;
    }

    strong {
      color: var(--el-text-color-primary);
      font-weight: 500;
    }
  }
}

// 暗色主题优化
:deep(.el-menu) {
  --el-menu-hover-bg-color: rgba(138, 109, 247, 0.1);
  --el-menu-active-color: v-bind(primaryColor);
}

:deep(.el-button--primary) {
  background-color: v-bind(primaryColor);
  border-color: v-bind(primaryColor);

  &:hover {
    background-color: #7352f5;
    border-color: #7352f5;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .app-sidebar {
    position: absolute;
    z-index: 1000;
    height: 100%;

    &:not(.collapsed) {
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    }
  }

  .app-content {
    margin-left: 0;
  }
}
</style>
