// IPC 通道名称
export const IPC_CHANNELS = {
  // 实体管理
  ENTITIES: {
    GET_TYPES: 'entities:getTypes',
    GET_TYPE: 'entities:getType',
    CREATE_TYPE: 'entities:createType',
    UPDATE_TYPE: 'entities:updateType',
    DELETE_TYPE: 'entities:deleteType',

    GET_ENTITIES: 'entities:getEntities',
    GET_ENTITY: 'entities:getEntity',
    CREATE_ENTITY: 'entities:createEntity',
    UPDATE_ENTITY: 'entities:updateEntity',
    DELETE_ENTITY: 'entities:deleteEntity',
    BATCH_DELETE: 'entities:batchDelete',
    EXPORT: 'entities:export',
    IMPORT: 'entities:import',

    SEARCH: 'entities:search',
    COUNT: 'entities:count'
  },

  // 文件管理
  FILES: {
    NEW_FILE: 'files:new',
    OPEN_FILE: 'files:open',
    SAVE_FILE: 'files:save',
    SAVE_AS: 'files:saveAs',
    EXPORT_FILE: 'files:export',
    IMPORT_FILE: 'files:import',

    GET_RECENT_FILES: 'files:getRecent',
    CLEAR_RECENT: 'files:clearRecent',
    GET_CURRENT_FILE: 'files:getCurrentFile',
    HAS_OPENED_FILE: 'files:hasOpenedFile',

    COMPRESS: 'files:compress',
    EXTRACT: 'files:extract'
  },

  // 插件管理
  PLUGINS: {
    // 基础插件管理
    GET_PLUGINS: 'plugins:getPlugins',
    GET_PLUGIN: 'plugins:getPlugin',
    INSTALL_PLUGIN: 'plugins:install',
    UNINSTALL_PLUGIN: 'plugins:uninstall',
    ENABLE_PLUGIN: 'plugins:enable',
    DISABLE_PLUGIN: 'plugins:disable',

    // 插件市场
    GET_MARKET_PLUGINS: 'plugins:getMarket',
    CHECK_UPDATES: 'plugins:checkUpdates',
    UPDATE_PLUGIN: 'plugins:update',
    SEARCH_PLUGINS: 'plugins:search',

    // 插件生命周期管理
    LOAD_PLUGIN: 'plugins:load',
    UNLOAD_PLUGIN: 'plugins:unload',
    INIT_PLUGIN: 'plugins:init',
    ACTIVATE_PLUGIN: 'plugins:activate',
    DEACTIVATE_PLUGIN: 'plugins:deactivate',
    RELOAD_PLUGIN: 'plugins:reloadPlugin',
    GET_PLUGIN_STATE: 'plugins:getState',

    // 插件事件系统
    SUBSCRIBE_EVENT: 'plugins:subscribeEvent',
    UNSUBSCRIBE_EVENT: 'plugins:unsubscribeEvent',
    EMIT_EVENT: 'plugins:emitEvent',
    GET_EVENT_LIST: 'plugins:getEventList',

    // 插件开发工具
    CREATE_PLUGIN: 'plugins:create',
    DEBUG_PLUGIN: 'plugins:debug',
    GET_PLUGIN_LOGS: 'plugins:getLogs',
    VALIDATE_PLUGIN: 'plugins:validate',
    SCAN_PLUGINS: 'plugins:scan',

    // 插件权限和安全
    GET_PERMISSIONS: 'plugins:getPermissions',
    SET_PERMISSIONS: 'plugins:setPermissions',
    CHECK_PERMISSIONS: 'plugins:checkPermissions',
    GRANT_PERMISSION: 'plugins:grantPermission',
    REVOKE_PERMISSION: 'plugins:revokePermission',

    // 插件运行时配置管理
    GET_PLUGIN_RUNTIME_CONFIG: 'plugins:getRuntimeConfig',
    SAVE_PLUGIN_RUNTIME_CONFIG: 'plugins:saveRuntimeConfig',
    GET_GRANTED_PERMISSIONS: 'plugins:getGrantedPermissions',
    SET_GRANTED_PERMISSIONS: 'plugins:setGrantedPermissions',
    CHECK_GRANTED_PERMISSION: 'plugins:checkGrantedPermission',
    GET_PENDING_PERMISSIONS: 'plugins:getPendingPermissions',

    // 插件依赖管理
    GET_DEPENDENCIES: 'plugins:getDependencies',
    INSTALL_DEPENDENCY: 'plugins:installDependency',
    CHECK_CONFLICTS: 'plugins:checkConflicts',
    RESOLVE_DEPENDENCIES: 'plugins:resolveDependencies',

    // 批量操作
    BATCH_ENABLE: 'plugins:batchEnable',
    BATCH_DISABLE: 'plugins:batchDisable',
    BATCH_UNINSTALL: 'plugins:batchUninstall',

    // 重载所有插件（保持向后兼容）
    RELOAD_PLUGINS: 'plugins:reloadAll'
  },

  // 配置管理
  CONFIG: {
    GET_CONFIG: 'config:get',
    SET_CONFIG: 'config:set',
    RESET_CONFIG: 'config:reset',

    GET_THEME: 'config:getTheme',
    SET_THEME: 'config:setTheme',

    EXPORT_CONFIG: 'config:export',
    IMPORT_CONFIG: 'config:import'
  },

  // 看板管理
  DASHBOARDS: {
    GET_DASHBOARDS: 'dashboards:get',
    GET_DASHBOARD: 'dashboards:getDashboard',
    CREATE_DASHBOARD: 'dashboards:create',
    UPDATE_DASHBOARD: 'dashboards:update',
    DELETE_DASHBOARD: 'dashboards:delete',

    GET_WIDGETS: 'dashboards:getWidgets',
    ADD_WIDGET: 'dashboards:addWidget',
    REMOVE_WIDGET: 'dashboards:removeWidget',
    UPDATE_WIDGET: 'dashboards:updateWidget'
  },

  // 系统管理
  SYSTEM: {
    GET_INFO: 'system:getInfo',
    GET_STATS: 'system:getStats',
    GET_LOGS: 'system:getLogs',
    CLEAR_LOGS: 'system:clearLogs',
    GET_GIT_REPO: 'system:getGitRepo',

    EXPORT_DATA: 'system:exportData',
    EXPORT_TO_FILE: 'system:exportToFile',
    LOG: 'system:log',

    RELOAD: 'system:reload',
    RESTART: 'system:restart',
    QUIT: 'system:quit'
  },

  // 工具函数
  UTILS: {
    PING: 'utils:ping',
    GET_VERSION: 'utils:getVersion',
    OPEN_EXTERNAL: 'utils:openExternal',
    SHOW_MESSAGE_BOX: 'utils:showMessageBox',
    SHOW_OPEN_DIALOG: 'utils:showOpenDialog',
    SHOW_SAVE_DIALOG: 'utils:showSaveDialog'
  }
} as const

// IPC 请求/响应类型
export interface IpcRequest<T = any> {
  id: string
  channel: string
  data?: T
  timestamp: number
}

export interface IpcResponse<T = any> {
  id: string
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

// IPC 错误类型
export interface IpcError {
  code: string
  message: string
  details?: any
}

// 主进程 IPC 处理器类型
export type IpcMainHandler<T = any, R = any> = (data: T) => Promise<R> | R

// 渲染进程 IPC 调用器类型
export type IpcRendererInvoker<T = any, R = any> = (data?: T) => Promise<R>
