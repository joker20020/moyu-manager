import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { EntityManagerAPI } from '../shared/types/api'
import { IPC_CHANNELS } from '../shared/types/ipc'
import type { EntityType, EntityInstance, EntityQuery } from '../shared/types/entities'
import type { PluginPermission } from '../shared/types/plugins'

// Generic IPC invokers for different arities
const createInvoker0 =
  <R = any>(channel: string) =>
  (): Promise<R> =>
    ipcRenderer.invoke(channel)
const createInvoker1 =
  <T = any, R = any>(channel: string) =>
  (arg: T): Promise<R> =>
    ipcRenderer.invoke(channel, arg)
const createInvoker2 =
  <T1 = any, T2 = any, R = any>(channel: string) =>
  (arg1: T1, arg2: T2): Promise<R> =>
    ipcRenderer.invoke(channel, arg1, arg2)
const createInvoker3 =
  <T1 = any, T2 = any, T3 = any, R = any>(channel: string) =>
  (arg1: T1, arg2: T2, arg3: T3): Promise<R> =>
    ipcRenderer.invoke(channel, arg1, arg2, arg3)
const createInvoker4 =
  <T1 = any, T2 = any, T3 = any, T4 = any, R = any>(channel: string) =>
  (arg1: T1, arg2: T2, arg3: T3, arg4: T4): Promise<R> =>
    ipcRenderer.invoke(channel, arg1, arg2, arg3, arg4)

// Custom APIs for renderer
const api = {
  // 实体管理
  entities: {
    // 类型管理
    getTypes: createInvoker0<EntityType[]>(IPC_CHANNELS.ENTITIES.GET_TYPES),
    getType: createInvoker1<string, EntityType>(IPC_CHANNELS.ENTITIES.GET_TYPE),
    createType: createInvoker1<Omit<EntityType, 'id' | 'createdAt' | 'updatedAt'>, EntityType>(
      IPC_CHANNELS.ENTITIES.CREATE_TYPE
    ),
    updateType: createInvoker2<string, Partial<EntityType>, EntityType>(
      IPC_CHANNELS.ENTITIES.UPDATE_TYPE
    ),
    deleteType: createInvoker1<string, boolean>(IPC_CHANNELS.ENTITIES.DELETE_TYPE),

    // 实体管理
    getEntities: createInvoker1<EntityQuery | undefined, EntityInstance[]>(
      IPC_CHANNELS.ENTITIES.GET_ENTITIES
    ),
    getEntity: createInvoker1<string, EntityInstance>(IPC_CHANNELS.ENTITIES.GET_ENTITY),
    createEntity: createInvoker1<Partial<EntityInstance>, EntityInstance>(
      IPC_CHANNELS.ENTITIES.CREATE_ENTITY
    ),
    updateEntity: createInvoker2<string, Partial<EntityInstance>, EntityInstance>(
      IPC_CHANNELS.ENTITIES.UPDATE_ENTITY
    ),
    deleteEntity: createInvoker1<string, boolean>(IPC_CHANNELS.ENTITIES.DELETE_ENTITY),
    batchDelete: createInvoker1<string[], number>(IPC_CHANNELS.ENTITIES.BATCH_DELETE),

    // 批量操作
    exportEntities: createInvoker2<EntityQuery | undefined, string | undefined, string>(
      IPC_CHANNELS.ENTITIES.EXPORT
    ),
    importEntities: createInvoker2<string, string | undefined, number>(
      IPC_CHANNELS.ENTITIES.IMPORT
    ),

    // 查询和统计
    search: createInvoker1<string, EntityInstance[]>(IPC_CHANNELS.ENTITIES.SEARCH),
    count: createInvoker1<EntityQuery | undefined, number>(IPC_CHANNELS.ENTITIES.COUNT)
  },

  // 文件管理
  files: {
    // 使用计算属性名来处理 'new' 关键字
    ['new']: createInvoker0<string>(IPC_CHANNELS.FILES.NEW_FILE),
    open: createInvoker1<string | undefined, boolean>(IPC_CHANNELS.FILES.OPEN_FILE),
    save: createInvoker1<string | undefined, boolean>(IPC_CHANNELS.FILES.SAVE_FILE),
    saveAs: createInvoker0<string | null>(IPC_CHANNELS.FILES.SAVE_AS),
    export: createInvoker2<string, string | undefined, boolean>(IPC_CHANNELS.FILES.EXPORT_FILE),
    import: createInvoker1<string, boolean>(IPC_CHANNELS.FILES.IMPORT_FILE),
    getRecentFiles: createInvoker0<string[]>(IPC_CHANNELS.FILES.GET_RECENT_FILES),
    clearRecentFiles: createInvoker0<void>(IPC_CHANNELS.FILES.CLEAR_RECENT),
    getCurrentFile: createInvoker0<string | null>(IPC_CHANNELS.FILES.GET_CURRENT_FILE),
    hasOpenedFile: createInvoker0<boolean>(IPC_CHANNELS.FILES.HAS_OPENED_FILE)
  },

  // 插件管理
  plugins: {
    getPlugins: createInvoker0<any[]>(IPC_CHANNELS.PLUGINS.GET_PLUGINS),
    getPlugin: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.GET_PLUGIN),
    installPlugin: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.INSTALL_PLUGIN),
    uninstallPlugin: createInvoker1<string, boolean>(IPC_CHANNELS.PLUGINS.UNINSTALL_PLUGIN),
    enablePlugin: createInvoker1<string, boolean>(IPC_CHANNELS.PLUGINS.ENABLE_PLUGIN),
    disablePlugin: createInvoker1<string, boolean>(IPC_CHANNELS.PLUGINS.DISABLE_PLUGIN),
    getMarketPlugins: createInvoker1<string | undefined, any[]>(
      IPC_CHANNELS.PLUGINS.GET_MARKET_PLUGINS
    ),
    checkUpdates: createInvoker0<any[]>(IPC_CHANNELS.PLUGINS.CHECK_UPDATES),
    updatePlugin: createInvoker1<string, boolean>(IPC_CHANNELS.PLUGINS.UPDATE_PLUGIN),
    reloadPlugins: createInvoker0<void>(IPC_CHANNELS.PLUGINS.RELOAD_PLUGINS),

    // 插件权限和安全
    getPermissions: createInvoker1<string, PluginPermission[]>(
      IPC_CHANNELS.PLUGINS.GET_PERMISSIONS
    ),
    setPermissions: createInvoker2<string, PluginPermission[], boolean>(
      IPC_CHANNELS.PLUGINS.SET_PERMISSIONS
    ),
    checkPermissions: createInvoker2<string, PluginPermission[], boolean>(
      IPC_CHANNELS.PLUGINS.CHECK_PERMISSIONS
    ),
    grantPermission: createInvoker2<string, PluginPermission, boolean>(
      IPC_CHANNELS.PLUGINS.GRANT_PERMISSION
    ),
    revokePermission: createInvoker2<string, PluginPermission, boolean>(
      IPC_CHANNELS.PLUGINS.REVOKE_PERMISSION
    ),

    // 插件运行时配置管理
    getPluginRuntimeConfig: createInvoker1<string, any>(
      IPC_CHANNELS.PLUGINS.GET_PLUGIN_RUNTIME_CONFIG
    ),
    savePluginRuntimeConfig: createInvoker2<string, any, boolean>(
      IPC_CHANNELS.PLUGINS.SAVE_PLUGIN_RUNTIME_CONFIG
    ),
    getGrantedPermissions: createInvoker1<string, PluginPermission[]>(
      IPC_CHANNELS.PLUGINS.GET_GRANTED_PERMISSIONS
    ),
    setGrantedPermissions: createInvoker2<string, PluginPermission[], boolean>(
      IPC_CHANNELS.PLUGINS.SET_GRANTED_PERMISSIONS
    ),
    checkGrantedPermission: createInvoker2<string, PluginPermission, boolean>(
      IPC_CHANNELS.PLUGINS.CHECK_GRANTED_PERMISSION
    ),
    getPendingPermissions: createInvoker1<string, PluginPermission[]>(
      IPC_CHANNELS.PLUGINS.GET_PENDING_PERMISSIONS
    ),

    // 插件生命周期管理
    loadPlugin: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.LOAD_PLUGIN),
    unloadPlugin: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.UNLOAD_PLUGIN),
    initPlugin: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.INIT_PLUGIN),
    activatePlugin: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.ACTIVATE_PLUGIN),
    deactivatePlugin: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.DEACTIVATE_PLUGIN),
    getPluginState: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.GET_PLUGIN_STATE),
    reloadPlugin: createInvoker1<string, any>(IPC_CHANNELS.PLUGINS.RELOAD_PLUGIN)
  },

  // 配置管理
  config: {
    get: createInvoker2<string, any | undefined, any>(IPC_CHANNELS.CONFIG.GET_CONFIG),
    set: createInvoker2<string, any, void>(IPC_CHANNELS.CONFIG.SET_CONFIG),
    reset: createInvoker1<string | undefined, void>(IPC_CHANNELS.CONFIG.RESET_CONFIG),
    getTheme: createInvoker0<string>(IPC_CHANNELS.CONFIG.GET_THEME),
    setTheme: createInvoker1<string, void>(IPC_CHANNELS.CONFIG.SET_THEME),
    exportConfig: createInvoker0<string>(IPC_CHANNELS.CONFIG.EXPORT_CONFIG),
    importConfig: createInvoker1<string, void>(IPC_CHANNELS.CONFIG.IMPORT_CONFIG)
  },

  // 看板管理
  dashboards: {
    getDashboards: createInvoker0<any[]>(IPC_CHANNELS.DASHBOARDS.GET_DASHBOARDS),
    getDashboard: createInvoker1<string, any>(IPC_CHANNELS.DASHBOARDS.GET_DASHBOARD),
    createDashboard: createInvoker1<any, any>(IPC_CHANNELS.DASHBOARDS.CREATE_DASHBOARD),
    updateDashboard: createInvoker2<string, any, any>(IPC_CHANNELS.DASHBOARDS.UPDATE_DASHBOARD),
    deleteDashboard: createInvoker1<string, boolean>(IPC_CHANNELS.DASHBOARDS.DELETE_DASHBOARD),
    getWidgets: createInvoker1<string, any[]>(IPC_CHANNELS.DASHBOARDS.GET_WIDGETS),
    addWidget: createInvoker2<string, any, any>(IPC_CHANNELS.DASHBOARDS.ADD_WIDGET),
    removeWidget: createInvoker2<string, string, boolean>(IPC_CHANNELS.DASHBOARDS.REMOVE_WIDGET),
    updateWidget: createInvoker3<string, string, any, any>(IPC_CHANNELS.DASHBOARDS.UPDATE_WIDGET)
  },

  // 系统管理
  system: {
    getInfo: createInvoker0<any>(IPC_CHANNELS.SYSTEM.GET_INFO),
    getStats: createInvoker0<any>(IPC_CHANNELS.SYSTEM.GET_STATS),
    getLogs: createInvoker2<string | undefined, number | undefined, any[]>(
      IPC_CHANNELS.SYSTEM.GET_LOGS
    ),
    clearLogs: createInvoker0<void>(IPC_CHANNELS.SYSTEM.CLEAR_LOGS),
    getGitRepo: createInvoker0<any>(IPC_CHANNELS.SYSTEM.GET_GIT_REPO),

    exportData: createInvoker0<any>(IPC_CHANNELS.SYSTEM.EXPORT_DATA),
    exportToFile: createInvoker1<string, void>(IPC_CHANNELS.SYSTEM.EXPORT_TO_FILE),
    log: createInvoker4<string, string, string | undefined, Record<string, any> | undefined, void>(
      IPC_CHANNELS.SYSTEM.LOG
    ),

    reload: createInvoker0<void>(IPC_CHANNELS.SYSTEM.RELOAD),
    restart: createInvoker0<void>(IPC_CHANNELS.SYSTEM.RESTART),
    quit: createInvoker0<void>(IPC_CHANNELS.SYSTEM.QUIT)
  },

  // 工具函数
  utils: {
    ping: createInvoker0<string>(IPC_CHANNELS.UTILS.PING),
    getVersion: createInvoker0<string>(IPC_CHANNELS.UTILS.GET_VERSION),
    openExternal: createInvoker1<string, void>(IPC_CHANNELS.UTILS.OPEN_EXTERNAL),
    showMessageBox: createInvoker1<any, any>(IPC_CHANNELS.UTILS.SHOW_MESSAGE_BOX),
    showOpenDialog: createInvoker1<any, any>(IPC_CHANNELS.UTILS.SHOW_OPEN_DIALOG),
    showSaveDialog: createInvoker1<any, any>(IPC_CHANNELS.UTILS.SHOW_SAVE_DIALOG)
  }
} as unknown as EntityManagerAPI

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
