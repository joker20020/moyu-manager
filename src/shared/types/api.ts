import type { EntityType, EntityInstance, EntityQuery } from './entities'
import type {
  Plugin,
  PluginManifest,
  PluginLifecycleState,
  PluginPermission,
  PluginRuntimeConfig,
  PluginOperationResult,
  PluginDependency
} from './plugins'
import type { Dashboard, Widget, DashboardQuery, WidgetQuery } from './dashboards'

// API 命名空间
export interface EntityManagerAPI {
  // 实体类型管理
  entities: {
    // 类型管理
    getTypes(): Promise<EntityType[]>
    getType(id: string): Promise<EntityType>
    createType(type: Omit<EntityType, 'id' | 'createdAt' | 'updatedAt'>): Promise<EntityType>
    updateType(id: string, updates: Partial<EntityType>): Promise<EntityType>
    deleteType(id: string): Promise<boolean>

    // 实体管理
    getEntities(query?: EntityQuery): Promise<EntityInstance[]>
    getEntity(id: string): Promise<EntityInstance>
    createEntity(entity: Partial<EntityInstance>): Promise<EntityInstance>
    updateEntity(id: string, updates: Partial<EntityInstance>): Promise<EntityInstance>
    deleteEntity(id: string): Promise<boolean>
    batchDelete(ids: string[]): Promise<number>

    // 批量操作
    exportEntities(filePath: string, query?: EntityQuery, format?: string): Promise<string>
    importEntities(filePath: string, format?: string): Promise<number>
    importEntitiesFromString(data: string, format?: string): number

    // 查询和统计
    search(query: string): Promise<EntityInstance[]>
    count(query?: EntityQuery): Promise<number>
  }

  // 文件管理
  files: {
    new (): Promise<string>
    open(path?: string): Promise<boolean>
    save(path?: string): Promise<boolean>
    saveAs(): Promise<string | null>

    export(path: string, format?: string): Promise<boolean>
    import(path: string): Promise<boolean>

    getRecentFiles(): Promise<string[]>
    clearRecentFiles(): Promise<void>
    getCurrentFile(): Promise<string | null>
    hasOpenedFile(): Promise<boolean>
  }

  // 插件管理
  plugins: {
    // 基础插件管理
    getPlugins(): Promise<Plugin[]>
    getPlugin(id: string): Promise<Plugin | null>
    installPlugin(source: string, manifest?: PluginManifest): Promise<Plugin>
    uninstallPlugin(id: string): Promise<boolean>
    enablePlugin(id: string): Promise<boolean>
    disablePlugin(id: string): Promise<boolean>

    // 插件市场
    getMarketPlugins(query?: string): Promise<PluginManifest[]>
    searchMarketPlugins(query: string, category?: string): Promise<PluginManifest[]>
    checkUpdates(): Promise<
      Array<{ pluginId: string; currentVersion: string; latestVersion: string; changelog?: string }>
    >
    updatePlugin(id: string): Promise<boolean>

    // 插件生命周期管理
    loadPlugin(id: string): Promise<PluginOperationResult>
    unloadPlugin(id: string): Promise<PluginOperationResult>
    initPlugin(id: string): Promise<PluginOperationResult>
    activatePlugin(id: string): Promise<PluginOperationResult>
    deactivatePlugin(id: string): Promise<PluginOperationResult>
    getPluginState(id: string): Promise<PluginLifecycleState>
    reloadPlugin(id: string): Promise<PluginOperationResult>

    // 插件事件系统
    subscribeEvent(event: string, callback: (data: any) => void): Promise<string> // 返回订阅ID
    unsubscribeEvent(subscriptionId: string): Promise<boolean>
    emitEvent(event: string, data?: any): Promise<boolean>
    getEventList(): Promise<string[]>

    // 插件开发工具
    createPlugin(template: string, options?: any): Promise<PluginOperationResult>
    debugPlugin(id: string): Promise<PluginOperationResult>
    getPluginLogs(id: string, limit?: number): Promise<string[]>
    validatePlugin(source: string): Promise<PluginOperationResult>
    scanPlugins(directory?: string): Promise<Plugin[]>

    // 插件权限和安全
    getPermissions(id: string): Promise<PluginPermission[]>
    setPermissions(id: string, permissions: PluginPermission[]): Promise<boolean>
    checkPermissions(id: string, requiredPermissions: PluginPermission[]): Promise<boolean>
    grantPermission(id: string, permission: PluginPermission): Promise<boolean>
    revokePermission(id: string, permission: PluginPermission): Promise<boolean>

    // 插件运行时配置管理
    getPluginRuntimeConfig(id: string): Promise<PluginRuntimeConfig | null>
    savePluginRuntimeConfig(id: string, config: Partial<PluginRuntimeConfig>): Promise<boolean>
    getGrantedPermissions(id: string): Promise<PluginPermission[]>
    setGrantedPermissions(id: string, permissions: PluginPermission[]): Promise<boolean>
    checkGrantedPermission(id: string, permission: PluginPermission): Promise<boolean>
    getPendingPermissions(id: string): Promise<PluginPermission[]>

    // 插件依赖管理
    getDependencies(id: string): Promise<PluginDependency[]>
    installDependency(id: string, dependency: PluginDependency): Promise<boolean>
    checkConflicts(id: string): Promise<string[]>
    resolveDependencies(id: string): Promise<PluginOperationResult>

    // 批量操作
    batchEnable(ids: string[]): Promise<PluginOperationResult[]>
    batchDisable(ids: string[]): Promise<PluginOperationResult[]>
    batchUninstall(ids: string[]): Promise<PluginOperationResult[]>

    // 重载所有插件（向后兼容）
    reloadPlugins(): Promise<void>
  }

  // 配置管理
  config: {
    get<T = any>(key: string, defaultValue?: T): Promise<T>
    set<T = any>(key: string, value: T): Promise<void>
    reset(key?: string): Promise<void>

    getTheme(): Promise<string>
    setTheme(theme: string): Promise<void>

    exportConfig(): Promise<string>
    importConfig(data: string): Promise<void>
  }

  // 看板管理
  dashboards: {
    getDashboards(query?: DashboardQuery): Promise<Dashboard[]>
    getDashboard(id: string): Promise<Dashboard | undefined>
    createDashboard(
      dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<Dashboard>
    updateDashboard(id: string, updates: Partial<Dashboard>): Promise<Dashboard | undefined>
    deleteDashboard(id: string): Promise<boolean>

    getWidgets(dashboardId: string): Promise<Widget[]>
    addWidget(dashboardId: string, widget: Omit<Widget, 'id' | 'dashboardId'>): Promise<Widget>
    removeWidget(dashboardId: string, widgetId: string): Promise<boolean>
    updateWidget(
      dashboardId: string,
      widgetId: string,
      updates: Partial<Widget>
    ): Promise<Widget | undefined>

    // 批量操作
    batchCreateDashboards(
      dashboards: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>[]
    ): Promise<Dashboard[]>
    batchDeleteDashboards(ids: string[]): Promise<number>

    // 查询
    searchDashboards(query: DashboardQuery): Promise<Dashboard[]>
    searchWidgets(query: WidgetQuery): Promise<Widget[]>
  }

  // 系统管理
  system: {
    getInfo(): Promise<any>
    getStats(): Promise<any>
    getLogs(level?: string, limit?: number): Promise<any[]>
    clearLogs(): Promise<void>
    getGitRepo(): Promise<{
      url: string
      branch: string
      commit: string
      hasChanges: boolean
    } | null>

    exportData(): Promise<{
      info: any
      stats: any
      logs: any[]
      timestamp: number
      exportVersion: string
    }>
    exportToFile(filePath: string): Promise<void>
    log(
      level: string,
      message: string,
      source?: string,
      metadata?: Record<string, any>
    ): Promise<void>

    reload(): Promise<void>
    restart(): Promise<void>
    quit(): Promise<void>
  }

  // 工具函数
  utils: {
    ping(): Promise<string>
    getVersion(): Promise<string>
    openExternal(url: string): Promise<void>
    showMessageBox(options: any): Promise<any>
    showOpenDialog(options: any): Promise<any>
    showSaveDialog(options: any): Promise<any>
  }
}

// Window 类型扩展
declare global {
  interface Window {
    api: EntityManagerAPI
  }
}
