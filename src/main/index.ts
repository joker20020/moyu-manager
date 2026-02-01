import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../shared/types/ipc'
// Services
import { EntityService } from './services/EntityService'
import { FileService } from './services/FileService'
import { PluginService } from './services/PluginService'
import { ConfigService } from './services/ConfigService'
import { DashboardService } from './services/DashboardService'
import { SystemService } from './services/SystemService'
import { UtilsService } from './services/UtilsService'
import { UpdateService } from './services/UpdateService'
import { SYSTEM_EVENTS } from '../shared/types/plugins'

// Service instances
let entityService: EntityService
let fileService: FileService
let pluginService: PluginService
let configService: ConfigService
let dashboardService: DashboardService
let systemService: SystemService
let utilsService: UtilsService
let updateService: UpdateService

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    ...(process.platform === 'linux'
      ? { icon: join(__dirname, '../../resources/icon.ico') }
      : { icon: join(__dirname, '../../resources/icon.ico') }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
  })

  // 完全禁用Electron默认菜单，使用自定义菜单
  mainWindow.setMenu(null)
  mainWindow.setTitle('moyu-manager')

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 设置SystemService的窗口重新加载处理器
  if (systemService) {
    systemService.setReloadWindowHandler(() => {
      mainWindow.reload()
    })
  }

  return mainWindow
}

function setupHandlers(mainWindow?: BrowserWindow): void {
  // Initialize services - order matters for dependencies
  entityService = new EntityService()
  configService = new ConfigService()
  dashboardService = new DashboardService()
  fileService = new FileService(entityService, configService, dashboardService)
  pluginService = new PluginService(configService, entityService, fileService)
  systemService = new SystemService()
  utilsService = new UtilsService()
  updateService = new UpdateService()

  // 设置主窗口引用（用于更新通知）
  if (mainWindow) {
    updateService.setMainWindow(mainWindow)
  }

  // 获取插件服务的事件发射器（用于发射IPC事件）
  const pluginEventEmitter = (pluginService as any).eventEmitter

  app.on('ready', () => {
    pluginEventEmitter.emit(SYSTEM_EVENTS.APP_READY)
  })
  pluginEventEmitter.emit(SYSTEM_EVENTS.APP_READY)
  app.on('before-quit', () => {
    pluginEventEmitter.emit(SYSTEM_EVENTS.APP_BEFORE_QUIT)
  })

  /**
   * 包装IPC处理器，添加事件发射功能
   * @param channel IPC通道名
   * @param handler 原始处理器函数
   * @returns 包装后的处理器函数
   */
  function wrapIpcHandler(
    channel: string,
    handler: (...args: any[]) => any
  ): (...args: any[]) => any {
    return async (...args: any[]) => {
      const eventData = {
        channel,
        args,
        timestamp: Date.now(),
        source: 'ipc'
      }
      const systemEventsValue = Object.values(SYSTEM_EVENTS) as string[]
      try {
        if (systemEventsValue.includes(channel)) {
          pluginEventEmitter.emit(channel, eventData)
        }

        // 调用原始处理器
        const result = await handler(...args)

        return result
      } catch (error) {
        // 发射响应事件（失败）
        const errorEventData = {
          ...eventData,
          error: error instanceof Error ? error.message : String(error),
          success: false
        }
        SystemService.logError(error, 'ipc', errorEventData)
        throw error
      }
    }
  }

  // Entity Management
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.GET_TYPES,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.GET_TYPES, () => entityService.getEntityTypes())
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.GET_TYPE,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.GET_TYPE, (_, id) => entityService.getEntityType(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.CREATE_TYPE,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.CREATE_TYPE, (_, typeData) =>
      entityService.createEntityType(typeData)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.UPDATE_TYPE,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.UPDATE_TYPE, (_, id, updates) =>
      entityService.updateEntityType(id, updates)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.DELETE_TYPE,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.DELETE_TYPE, (_, id) => entityService.deleteEntityType(id))
  )

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.GET_ENTITIES,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.GET_ENTITIES, (_, query) =>
      entityService.getEntities(query)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.GET_ENTITY,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.GET_ENTITY, (_, id) => entityService.getEntity(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.CREATE_ENTITY,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.CREATE_ENTITY, (_, entityData) =>
      entityService.createEntity(entityData)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.UPDATE_ENTITY,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.UPDATE_ENTITY, (_, id, updates) =>
      entityService.updateEntity(id, updates)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.DELETE_ENTITY,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.DELETE_ENTITY, (_, id) => entityService.deleteEntity(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.BATCH_DELETE,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.BATCH_DELETE, (_, ids) => entityService.batchDelete(ids))
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.EXPORT,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.EXPORT, (_, query) => entityService.exportEntities(query))
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.IMPORT,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.IMPORT, (_, data) => entityService.importEntities(data))
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.SEARCH,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.SEARCH, (_, query) => entityService.search(query))
  )
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES.COUNT,
    wrapIpcHandler(IPC_CHANNELS.ENTITIES.COUNT, (_, query) => entityService.count(query))
  )

  // File Management
  ipcMain.handle(
    IPC_CHANNELS.FILES.NEW_FILE,
    wrapIpcHandler(IPC_CHANNELS.FILES.NEW_FILE, () => fileService.newFile())
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.OPEN_FILE,
    wrapIpcHandler(IPC_CHANNELS.FILES.OPEN_FILE, (_, path) => fileService.open(path))
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.SAVE_FILE,
    wrapIpcHandler(IPC_CHANNELS.FILES.SAVE_FILE, (_, path) => fileService.save(path))
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.SAVE_AS,
    wrapIpcHandler(IPC_CHANNELS.FILES.SAVE_AS, () => fileService.saveAs())
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.EXPORT_FILE,
    wrapIpcHandler(IPC_CHANNELS.FILES.EXPORT_FILE, (_, path, format) =>
      fileService.exportFile(path, format)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.IMPORT_FILE,
    wrapIpcHandler(IPC_CHANNELS.FILES.IMPORT_FILE, (_, path) => fileService.importFile(path))
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.GET_RECENT_FILES,
    wrapIpcHandler(IPC_CHANNELS.FILES.GET_RECENT_FILES, () => fileService.getRecentFiles())
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.CLEAR_RECENT,
    wrapIpcHandler(IPC_CHANNELS.FILES.CLEAR_RECENT, () => fileService.clearRecentFiles())
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.GET_CURRENT_FILE,
    wrapIpcHandler(IPC_CHANNELS.FILES.GET_CURRENT_FILE, () => fileService.getCurrentFilePath())
  )
  ipcMain.handle(
    IPC_CHANNELS.FILES.HAS_OPENED_FILE,
    wrapIpcHandler(IPC_CHANNELS.FILES.HAS_OPENED_FILE, () => fileService.hasOpenedFile())
  )

  // Plugin Management
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GET_PLUGINS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GET_PLUGINS, () => pluginService.getPlugins())
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GET_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GET_PLUGIN, (_, id) => pluginService.getPlugin(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.INSTALL_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.INSTALL_PLUGIN, (_, source) =>
      pluginService.installPlugin(source)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.UNINSTALL_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.UNINSTALL_PLUGIN, (_, id) =>
      pluginService.uninstallPlugin(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.ENABLE_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.ENABLE_PLUGIN, (_, id) => pluginService.enablePlugin(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.DISABLE_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.DISABLE_PLUGIN, (_, id) => pluginService.disablePlugin(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GET_MARKET_PLUGINS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GET_MARKET_PLUGINS, (_, query) =>
      pluginService.getMarketPlugins(query)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.CHECK_UPDATES,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.CHECK_UPDATES, () => pluginService.checkUpdates())
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.UPDATE_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.UPDATE_PLUGIN, (_, id) => pluginService.updatePlugin(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.RELOAD_PLUGINS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.RELOAD_PLUGINS, () => pluginService.reloadPlugins())
  )

  // Plugin Permission Management
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GET_PERMISSIONS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GET_PERMISSIONS, (_, id) =>
      pluginService.getPermissions(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.SET_PERMISSIONS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.SET_PERMISSIONS, (_, id, permissions) =>
      pluginService.setPermissions(id, permissions)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.CHECK_PERMISSIONS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.CHECK_PERMISSIONS, (_, id, requiredPermissions) =>
      pluginService.checkPermissions(id, requiredPermissions)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GRANT_PERMISSION,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GRANT_PERMISSION, (_, id, permission) =>
      pluginService.grantPermission(id, permission)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.REVOKE_PERMISSION,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.REVOKE_PERMISSION, (_, id, permission) =>
      pluginService.revokePermission(id, permission)
    )
  )

  // Plugin Runtime Config Management
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GET_PLUGIN_RUNTIME_CONFIG,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GET_PLUGIN_RUNTIME_CONFIG, (_, id) =>
      pluginService.getPluginRuntimeConfig(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.SAVE_PLUGIN_RUNTIME_CONFIG,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.SAVE_PLUGIN_RUNTIME_CONFIG, (_, id, config) =>
      pluginService.savePluginRuntimeConfig(id, config)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GET_GRANTED_PERMISSIONS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GET_GRANTED_PERMISSIONS, (_, id) =>
      pluginService.getGrantedPermissions(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.SET_GRANTED_PERMISSIONS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.SET_GRANTED_PERMISSIONS, (_, id, permissions) =>
      pluginService.setGrantedPermissions(id, permissions)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.CHECK_GRANTED_PERMISSION,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.CHECK_GRANTED_PERMISSION, (_, id, permission) =>
      pluginService.checkGrantedPermission(id, permission)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GET_PENDING_PERMISSIONS,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GET_PENDING_PERMISSIONS, (_, id) =>
      pluginService.getPendingPermissions(id)
    )
  )

  // Plugin Lifecycle Management
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.LOAD_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.LOAD_PLUGIN, (_, id) => pluginService.loadPlugin(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.UNLOAD_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.UNLOAD_PLUGIN, (_, id) => pluginService.unloadPlugin(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.INIT_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.INIT_PLUGIN, (_, id) => pluginService.initPlugin(id))
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.ACTIVATE_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.ACTIVATE_PLUGIN, (_, id) =>
      pluginService.activatePlugin(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.DEACTIVATE_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.DEACTIVATE_PLUGIN, (_, id) =>
      pluginService.deactivatePlugin(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.GET_PLUGIN_STATE,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.GET_PLUGIN_STATE, (_, id) =>
      pluginService.getPluginState(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.PLUGINS.RELOAD_PLUGIN,
    wrapIpcHandler(IPC_CHANNELS.PLUGINS.RELOAD_PLUGIN, (_, id) => pluginService.reloadPlugin(id))
  )

  // Configuration Management
  ipcMain.handle(
    IPC_CHANNELS.CONFIG.GET_CONFIG,
    wrapIpcHandler(IPC_CHANNELS.CONFIG.GET_CONFIG, (_, key, defaultValue) =>
      configService.get(key, defaultValue)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.CONFIG.SET_CONFIG,
    wrapIpcHandler(IPC_CHANNELS.CONFIG.SET_CONFIG, (_, key, value) => configService.set(key, value))
  )
  ipcMain.handle(
    IPC_CHANNELS.CONFIG.RESET_CONFIG,
    wrapIpcHandler(IPC_CHANNELS.CONFIG.RESET_CONFIG, (_, key) => configService.reset(key))
  )
  ipcMain.handle(
    IPC_CHANNELS.CONFIG.GET_THEME,
    wrapIpcHandler(IPC_CHANNELS.CONFIG.GET_THEME, () => configService.getTheme())
  )
  ipcMain.handle(
    IPC_CHANNELS.CONFIG.SET_THEME,
    wrapIpcHandler(IPC_CHANNELS.CONFIG.SET_THEME, (_, theme) => configService.setTheme(theme))
  )
  ipcMain.handle(
    IPC_CHANNELS.CONFIG.EXPORT_CONFIG,
    wrapIpcHandler(IPC_CHANNELS.CONFIG.EXPORT_CONFIG, () => configService.exportConfig())
  )
  ipcMain.handle(
    IPC_CHANNELS.CONFIG.IMPORT_CONFIG,
    wrapIpcHandler(IPC_CHANNELS.CONFIG.IMPORT_CONFIG, (_, data) => configService.importConfig(data))
  )

  // Dashboard Management
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.GET_DASHBOARDS,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.GET_DASHBOARDS, () => dashboardService.getDashboards())
  )
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.GET_DASHBOARD,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.GET_DASHBOARD, (_, id) =>
      dashboardService.getDashboard(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.CREATE_DASHBOARD,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.CREATE_DASHBOARD, (_, dashboard) =>
      dashboardService.createDashboard(dashboard)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.UPDATE_DASHBOARD,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.UPDATE_DASHBOARD, (_, id, updates) =>
      dashboardService.updateDashboard(id, updates)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.DELETE_DASHBOARD,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.DELETE_DASHBOARD, (_, id) =>
      dashboardService.deleteDashboard(id)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.GET_WIDGETS,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.GET_WIDGETS, (_, dashboardId) =>
      dashboardService.getWidgets(dashboardId)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.ADD_WIDGET,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.ADD_WIDGET, (_, dashboardId, widget) =>
      dashboardService.addWidget(dashboardId, widget)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.REMOVE_WIDGET,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.REMOVE_WIDGET, (_, dashboardId, widgetId) =>
      dashboardService.removeWidget(dashboardId, widgetId)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.DASHBOARDS.UPDATE_WIDGET,
    wrapIpcHandler(IPC_CHANNELS.DASHBOARDS.UPDATE_WIDGET, (_, dashboardId, widgetId, updates) =>
      dashboardService.updateWidget(dashboardId, widgetId, updates)
    )
  )

  // System Management
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.GET_INFO,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.GET_INFO, () => systemService.getInfo())
  )
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.GET_STATS,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.GET_STATS, () => systemService.getStats())
  )
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.GET_LOGS,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.GET_LOGS, (_, level, limit) =>
      systemService.getLogs(level, limit)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.CLEAR_LOGS,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.CLEAR_LOGS, () => systemService.clearLogs())
  )
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.GET_GIT_REPO,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.GET_GIT_REPO, () => systemService.getGitRepositoryInfo())
  )
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.RELOAD,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.RELOAD, () => systemService.reload())
  )
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.RESTART,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.RESTART, () => systemService.restart())
  )
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.QUIT,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.QUIT, () => systemService.quit())
  )

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.EXPORT_DATA,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.EXPORT_DATA, () => systemService.exportSystemData())
  )

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.EXPORT_TO_FILE,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.EXPORT_TO_FILE, (_, filePath) =>
      systemService.exportToFile(filePath)
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM.LOG,
    wrapIpcHandler(IPC_CHANNELS.SYSTEM.LOG, (_, level, message, source, metadata) =>
      systemService.log(level, message, source, metadata)
    )
  )

  // Utility Functions
  ipcMain.handle(
    IPC_CHANNELS.UTILS.PING,
    wrapIpcHandler(IPC_CHANNELS.UTILS.PING, () => utilsService.ping())
  )
  ipcMain.handle(
    IPC_CHANNELS.UTILS.GET_VERSION,
    wrapIpcHandler(IPC_CHANNELS.UTILS.GET_VERSION, () => utilsService.getVersion())
  )
  ipcMain.handle(
    IPC_CHANNELS.UTILS.OPEN_EXTERNAL,
    wrapIpcHandler(IPC_CHANNELS.UTILS.OPEN_EXTERNAL, (_, url) => utilsService.openExternal(url))
  )
  ipcMain.handle(
    IPC_CHANNELS.UTILS.SHOW_MESSAGE_BOX,
    wrapIpcHandler(IPC_CHANNELS.UTILS.SHOW_MESSAGE_BOX, (_, options) =>
      utilsService.showMessageBox(options)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.UTILS.SHOW_OPEN_DIALOG,
    wrapIpcHandler(IPC_CHANNELS.UTILS.SHOW_OPEN_DIALOG, (_, options) =>
      utilsService.showOpenDialog(options)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.UTILS.SHOW_SAVE_DIALOG,
    wrapIpcHandler(IPC_CHANNELS.UTILS.SHOW_SAVE_DIALOG, (_, options) =>
      utilsService.showSaveDialog(options)
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.UPDATE.CHECK_FOR_UPDATES,
    wrapIpcHandler(IPC_CHANNELS.UPDATE.CHECK_FOR_UPDATES, (_, options) =>
      updateService.checkForUpdates(options)
    )
  )
  ipcMain.handle(
    IPC_CHANNELS.UPDATE.DOWNLOAD_UPDATE,
    wrapIpcHandler(IPC_CHANNELS.UPDATE.DOWNLOAD_UPDATE, () => updateService.downloadUpdate())
  )
  ipcMain.handle(
    IPC_CHANNELS.UPDATE.INSTALL_UPDATE,
    wrapIpcHandler(IPC_CHANNELS.UPDATE.INSTALL_UPDATE, () => updateService.installUpdate())
  )
  ipcMain.handle(
    IPC_CHANNELS.UPDATE.GET_UPDATE_INFO,
    wrapIpcHandler(IPC_CHANNELS.UPDATE.GET_UPDATE_INFO, () => updateService.getUpdateInfo())
  )
  ipcMain.handle(
    IPC_CHANNELS.UPDATE.CANCEL_UPDATE,
    wrapIpcHandler(IPC_CHANNELS.UPDATE.CANCEL_UPDATE, () => updateService.cancelUpdate())
  )
}


app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.moyu.entity-manager')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Setup IPC handlers
  const mainWindow = createWindow()
  setupHandlers(mainWindow)

  // 打开最近文件
  const recentFiles = await fileService.getRecentFiles()
  if (recentFiles.length > 0) {
    const latestFile = recentFiles[0]
    fileService.open(latestFile).catch((err) => {
      console.error('Failed to open recent file on startup:', err)
    })
  }

  // 处理双击打开
  if (process.argv.length >= 2){
    const argv = process.argv.slice(app.isPackaged ? 1 : 2)
    const filePath =
      argv.find((arg) => arg.endsWith('.em')) ||
      argv.find((arg) => arg.includes('--file'))?.split('=')[1]
    if (filePath && filePath.endsWith('.em')){
      fileService.open(filePath).catch((err) => {
        console.error('Failed to open file on startup:', err)
      })
    }
  }

  // 延迟执行自动更新检查（避免影响应用启动速度）
  setTimeout(async () => {
    try {
      const autoCheckEnabled = await configService.get('update.autoCheck', true)
      if (autoCheckEnabled && updateService) {
        console.log('[Main] 执行自动更新检查...')
        await updateService.checkForUpdates({ silent: true })
      }
    } catch (error) {
      console.error('[Main] 自动更新检查失败:', error)
    }
  }, 10000) // 10秒后检查

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
