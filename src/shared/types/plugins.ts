// 插件系统核心类型定义
import { IPC_CHANNELS } from './ipc'

// ==================== 插件生命周期状态 ====================

/**
 * 插件生命周期状态枚举
 */
export enum PluginLifecycleState {
  /** 未加载状态 */
  UNLOADED = 'unloaded',

  /** 加载中状态 */
  LOADING = 'loading',

  /** 已加载但未初始化 */
  LOADED = 'loaded',

  /** 初始化中 */
  INITIALIZING = 'initializing',

  /** 已初始化，可激活 */
  INITIALIZED = 'initialized',

  /** 激活中 */
  ACTIVATING = 'activating',

  /** 已激活，正常运行 */
  ACTIVE = 'active',

  /** 停用中 */
  DEACTIVATING = 'deactivating',

  /** 已停用，但已加载 */
  INACTIVE = 'inactive',

  /** 错误状态 */
  ERROR = 'error'
}

// ==================== 插件权限系统 ====================

/**
 * 插件权限常量列表
 */
export const PLUGIN_PERMISSIONS = {
  APP_READY: 'app:ready',
  APP_BEFORE_QUIT: 'app:before-quit',
  WINDOW_CREATED: 'window:created',
  WINDOW_CLOSED: 'window:closed',
  // 文件权限
  OPEN_FILE: IPC_CHANNELS.FILES.OPEN_FILE,
  SAVE_FILE: IPC_CHANNELS.FILES.SAVE_FILE,
  // 实体权限
  CREATE_ENTITY: IPC_CHANNELS.ENTITIES.CREATE_ENTITY,
  UPDATE_ENTITY: IPC_CHANNELS.ENTITIES.UPDATE_ENTITY,
  DELETE_ENTITY: IPC_CHANNELS.ENTITIES.DELETE_ENTITY,
  GET_ENTITY: IPC_CHANNELS.ENTITIES.GET_ENTITY,
  GET_ENTITIES: IPC_CHANNELS.ENTITIES.GET_ENTITIES,
  GET_ENTITY_TYPE: IPC_CHANNELS.ENTITIES.GET_TYPE,
  GET_ENTITY_TYPES: IPC_CHANNELS.ENTITIES.GET_TYPES,
  // 插件权限
  LOAD_PLUGIN: IPC_CHANNELS.PLUGINS.LOAD_PLUGIN,
  UNLOAD_PLUGIN: IPC_CHANNELS.PLUGINS.UNLOAD_PLUGIN,
  RELOAD_PLUGIN: IPC_CHANNELS.PLUGINS.RELOAD_PLUGIN,
  ACTIVATE_PLUGIN: IPC_CHANNELS.PLUGINS.ACTIVATE_PLUGIN,
  DEACTIVATE_PLUGIN: IPC_CHANNELS.PLUGINS.DEACTIVATE_PLUGIN,
  PLUGIN_LOADED: 'plugin:loaded',
  PLUGIN_INITIALIZED: 'plugin:initialized',
  PLUGIN_ACTIVATED: 'plugin:activated',
  PLUGIN_DEACTIVATED: 'plugin:deactivated',
  PLUGIN_ERROR: 'plugin:error',
  PLUGIN_CONFIG_CHANGED: 'plugin:configChanged',
  // 配置权限
  READ_CONFIG: IPC_CHANNELS.CONFIG.GET_CONFIG,
  WRITE_CONFIG: IPC_CHANNELS.CONFIG.SET_CONFIG,
  // UI权限
  UI_SHOW: 'ui:show',
  UI_MODIFY: 'ui:modify',

  // 网络和系统权限
  NETWORK_ACCESS: 'network:access',

  // 事件权限
  EVENTS_SUBSCRIBE: 'events:subscribe'
} as const

/**
 * 插件权限类型
 */
export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[keyof typeof PLUGIN_PERMISSIONS]
/**
 * 插件权限配置接口
 */
export interface PluginPermissionConfig {
  /** 权限名称 */
  name: PluginPermission
  /** 权限描述 */
  description: string
  /** 是否为必需权限 */
  required: boolean
  /** 权限级别（low, medium, high） */
  level: 'low' | 'medium' | 'high'
}

// ==================== 插件清单定义 ====================

/**
 * 插件命令定义（插件贡献的命令）
 */
export interface PluginCommand {
  /** 命令ID */
  id: string
  /** 命令名称 */
  name: string
  /** 命令描述 */
  description?: string
  /** 命令图标 */
  icon?: string
  /** 命令快捷键 */
  shortcut?: string
  /** 命令执行函数（在主进程中执行） */
  handler?: () => void | Promise<void>
}

/**
 * 插件视图定义（插件贡献的界面视图）
 */
export interface PluginView {
  /** 视图ID */
  id: string
  /** 视图名称 */
  name: string
  /** 视图描述 */
  description?: string
  /** 视图图标 */
  icon?: string
  /** 视图组件路径（Vue组件相对路径） */
  component?: string
  /** 视图位置（侧边栏、工具栏等） */
  position?: 'sidebar' | 'toolbar' | 'statusbar' | 'main'
}

/**
 * 插件菜单定义
 */
export interface PluginMenu {
  /** 菜单ID */
  id: string
  /** 菜单名称 */
  name: string
  /** 菜单位置 */
  position: 'file' | 'edit' | 'view' | 'plugin' | 'help'
  /** 菜单顺序 */
  order?: number
  /** 子菜单项 */
  items?: PluginMenuItem[]
}

/**
 * 插件菜单项定义
 */
export interface PluginMenuItem {
  /** 菜单项ID */
  id: string
  /** 菜单项名称 */
  name: string
  /** 菜单项图标 */
  icon?: string
  /** 菜单项快捷键 */
  shortcut?: string
  /** 菜单项执行函数 */
  handler?: () => void | Promise<void>
}

/**
 * 插件依赖定义
 */
export interface PluginDependency {
  /** 依赖插件ID */
  pluginId: string
  /** 版本约束（semver格式） */
  version: string
  /** 是否为可选依赖 */
  optional?: boolean
}

/**
 * 插件清单（PluginManifest）接口
 * 插件的基本元数据定义，类似package.json
 */
export interface PluginManifest {
  // 基本信息
  /** 插件唯一标识符（必须全小写，使用连字符分隔） */
  id: string
  /** 插件显示名称 */
  name: string
  /** 插件版本（遵循语义化版本规范） */
  version: string
  /** 插件描述 */
  description: string
  /** 作者信息 */
  author: string
  /** 插件主页URL */
  homepage?: string
  /** 插件仓库URL */
  repository?: string

  // 技术信息
  /** 插件主入口文件路径（相对于插件根目录） */
  main?: string
  /** 插件图标路径（相对于插件根目录） */
  icon?: string
  /** 插件截图路径数组 */
  screenshots?: string[]
  /** 关键字标签 */
  keywords?: string[]
  /** 插件分类 */
  category: 'system' | 'user'

  // 兼容性
  /** 兼容的实体管理器版本范围（semver格式） */
  compatibility: string
  /** 依赖的Node.js版本 */
  engines?: {
    node?: string
  }

  // 依赖管理
  /** 依赖的其他插件 */
  dependencies?: PluginDependency[]
  /** 可选的依赖 */
  optionalDependencies?: PluginDependency[]
  /** 冲突的插件 */
  conflicts?: string[]

  // 安全性
  /** 插件所需的权限列表 */
  permissions?: PluginPermission[]
  /** 许可证类型 */
  license: string

  // 贡献点
  /** 插件贡献的命令 */
  commands?: PluginCommand[]
  /** 插件贡献的视图 */
  views?: PluginView[]
  /** 插件贡献的菜单 */
  menus?: PluginMenu[]
}

// ==================== 插件配置定义 ====================

/**
 * 插件配置字段定义
 */
export interface PluginConfigField {
  /** 配置字段ID */
  id: string
  /** 配置字段显示名称 */
  name: string
  /** 配置字段类型 */
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'color' | 'file'
  /** 字段描述 */
  description?: string
  /** 默认值 */
  defaultValue?: any
  /** 选项列表（select/multiselect类型使用） */
  options?: Array<{ label: string; value: any }>
  /** 验证规则 */
  validation?: {
    required?: boolean
    min?: number
    max?: number
    pattern?: string
    custom?: (value: any) => boolean | string
  }
}

/**
 * 插件配置定义
 */
export interface PluginConfiguration {
  /** 配置字段定义 */
  fields?: PluginConfigField[]
  /** 配置数据（由用户设置） */
  data?: Record<string, any>
}

// ==================== 插件运行时配置 ====================

/**
 * 插件运行时配置接口
 * 存储在插件安装目录下的 plugin-config.json 中
 */
export interface PluginRuntimeConfig {
  /** 配置版本（用于迁移） */
  version: string

  /** 插件启用状态 */
  enabled: boolean

  /** 用户授予的权限列表 */
  grantedPermissions: PluginPermission[]

  /** 插件自定义配置（可选） */
  customConfig?: Record<string, any>

  /** 配置更新时间 */
  updatedAt?: number
}

/**
 * 默认运行时配置
 */
export const DEFAULT_RUNTIME_CONFIG: PluginRuntimeConfig = {
  version: '1.0',
  enabled: false,
  grantedPermissions: []
}

// ==================== 插件实例定义 ====================

/**
 * 插件实例接口
 */
export interface Plugin {
  // 元数据
  /** 插件清单 */
  manifest: PluginManifest
  /** 插件安装路径 */
  installPath: string
  /** 插件安装时间戳 */
  installedAt: number
  /** 插件最后更新时间戳 */
  updatedAt?: number

  // 运行时状态
  /** 插件当前生命周期状态 */
  state: PluginLifecycleState
  /** 插件是否启用（从runtimeConfig读取） */
  enabled: boolean
  /** 插件错误信息（如果有） */
  error?: {
    message: string
    stack?: string
    timestamp: number
  }

  // 运行时配置
  /** 插件运行时配置 */
  runtimeConfig?: PluginRuntimeConfig

  // 运行时引用
  /** 插件实例（加载的模块） */
  instance?: any
  /** 插件上下文 */
  context?: PluginContext
}

// ==================== 插件上下文定义 ====================

/**
 * 实体API接口（提供给插件）
 */
export interface PluginEntityAPI {
  /** 获取实体类型列表 */
  getTypes(): Promise<any[]>
  /** 获取指定实体类型 */
  getType(id: string): Promise<any>
  /** 获取实体列表 */
  getEntities(query?: any): Promise<any[]>
  /** 获取单个实体 */
  getEntity(id: string): Promise<any>
  /** 创建实体 */
  createEntity(entity: Partial<any>): Promise<any>
  /** 更新实体 */
  updateEntity(id: string, updates: Partial<any>): Promise<any>
  /** 删除实体 */
  deleteEntity(id: string): Promise<boolean>
}

/**
 * 文件API接口（提供给插件）
 */
export interface PluginFileAPI {
  /** 读取文件 */
  read(path: string): Promise<string>
  /** 写入文件 */
  write(path: string, content: string): Promise<void>
  /** 检查文件是否存在 */
  exists(path: string): Promise<boolean>
  /** 获取文件信息 */
  stat(path: string): Promise<any>
}

/**
 * 配置API接口（提供给插件）
 */
export interface PluginConfigAPI {
  /** 获取配置值 */
  get<T = any>(key: string, defaultValue?: T): Promise<T>
  /** 设置配置值 */
  set<T = any>(key: string, value: T): Promise<void>
  /** 删除配置项 */
  delete(key: string): Promise<void>
}

/**
 * UI API接口（提供给插件）
 */
export interface PluginUIApi {
  /** 显示通知 */
  showNotification(options: {
    title: string
    message: string
    type?: 'success' | 'warning' | 'error' | 'info'
    duration?: number
  }): Promise<void>

  /** 显示对话框 */
  showDialog(options: {
    title: string
    message: string
    type?: 'alert' | 'confirm' | 'prompt'
    buttons?: string[]
  }): Promise<any>

  /** 打开URL */
  openExternal(url: string): Promise<void>
}

/**
 * 插件工具函数
 */
export interface PluginUtils {
  /** 生成唯一ID */
  generateId(): string
  /** 格式化日期 */
  formatDate(date: Date, format?: string): string
  /** 深拷贝对象 */
  deepClone<T>(obj: T): T
  /** 防抖函数 */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void
  /** 节流函数 */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void
}

/**
 * 插件存储接口
 */
export interface PluginStorage {
  /** 获取存储值 */
  get<T = any>(key: string): Promise<T | null>
  /** 设置存储值 */
  set<T = any>(key: string, value: T): Promise<void>
  /** 删除存储值 */
  delete(key: string): Promise<void>
  /** 清空存储 */
  clear(): Promise<void>
  /** 获取所有键 */
  keys(): Promise<string[]>
}

/**
 * 插件日志接口
 */
export interface PluginLogger {
  /** 调试日志 */
  debug(message: string, ...args: any[]): void
  /** 信息日志 */
  info(message: string, ...args: any[]): void
  /** 警告日志 */
  warn(message: string, ...args: any[]): void
  /** 错误日志 */
  error(message: string, ...args: any[]): void
}

/**
 * 插件事件系统接口
 */
export interface PluginEventEmitter {
  /** 订阅事件 */
  on(event: string, listener: (data?: any) => void): () => void
  /** 一次性订阅事件 */
  once(event: string, listener: (data?: any) => void): () => void
  /** 取消订阅事件 */
  off(event: string, listener: (data?: any) => void): () => void
  /** 触发事件 */
  emit(event: string, data?: any): void
}

/**
 * 插件上下文接口
 * 提供给插件的受限API访问环境
 */
export interface PluginContext {
  // 插件信息
  /** 插件ID */
  pluginId: string
  /** 插件版本 */
  pluginVersion: string

  // API访问（需要相应权限）
  /** 实体API（需要entities权限） */
  entities?: PluginEntityAPI
  /** 文件API（需要files权限） */
  files?: PluginFileAPI
  /** 配置API（需要config权限） */
  config?: PluginConfigAPI
  /** UI API（需要ui权限） */
  ui?: PluginUIApi

  // 工具函数
  /** 工具函数 */
  utils: PluginUtils
  /** 插件私有存储 */
  storage: PluginStorage
  /** 插件日志器 */
  logger: PluginLogger

  // 事件系统
  /** 事件发射器 */
  events: PluginEventEmitter

  // 元数据
  /** 插件安装路径 */
  installPath: string
  /** 插件是否已激活 */
  isActive: boolean

  // 生命周期方法（由插件服务调用）
  /** 激活插件上下文 */
  activate(): void
  /** 停用插件上下文 */
  deactivate(): void

  // 权限管理
  /** 检查插件是否拥有指定权限 */
  hasPermission(permission: string): boolean
  /** 添加权限（动态权限管理） */
  addPermission(permission: string): void
  /** 移除权限 */
  removePermission(permission: string): void
}

// ==================== 插件事件定义 ====================

/**
 * 插件事件接口
 */
export interface PluginEvent {
  /** 事件类型 */
  type: SystemEventType | PluginEventType | string
  /** 事件数据 */
  data?: any
  /** 事件时间戳 */
  timestamp: number
  /** 事件来源（插件ID或'system'） */
  source: string
}

// ==================== 插件操作结果 ====================

/**
 * 插件操作结果接口
 */
export interface PluginOperationResult {
  /** 操作是否成功 */
  success: boolean
  /** 操作消息 */
  message?: string
  /** 操作数据 */
  data?: any
  /** 错误信息 */
  error?: string
  /** 插件ID */
  pluginId?: string
}

// ==================== 常量定义 ====================

/**
 * 默认插件目录路径
 */
export const DEFAULT_PLUGIN_DIRS = {
  /** 系统插件目录 */
  SYSTEM: 'plugins/system',
  /** 用户插件目录 */
  USER: 'plugins/user',
  /** 开发插件目录 */
  DEV: 'plugins/dev'
}

/**
 * 插件清单文件名
 */
export const PLUGIN_MANIFEST_FILE = 'plugin.json'

/**
 * 插件入口文件名
 */
export const PLUGIN_MAIN_FILE = 'index.js'

/**
 * 插件支持的文件扩展名
 */
export const PLUGIN_FILE_EXTENSIONS = ['.js', '.ts']

// ==================== 工具类型 ====================

/**
 * 提取插件贡献点类型
 */
export type ExtractPluginContribution<T extends keyof PluginManifest> =
  NonNullable<PluginManifest[T]> extends Array<infer U> ? U : never

/**
 * 插件命令类型
 */
export type PluginCommandType = ExtractPluginContribution<'commands'>

/**
 * 插件视图类型
 */
export type PluginViewType = ExtractPluginContribution<'views'>

/**
 * 插件菜单类型
 */
export type PluginMenuType = ExtractPluginContribution<'menus'>

/**
 * 检查插件是否具有特定权限
 */
export type PluginHasPermission<_T extends PluginPermission> = (manifest: PluginManifest) => boolean

// ==================== 更多常量定义 ====================

/**
 * 系统事件常量列表
 */
export const SYSTEM_EVENTS = {
  APP_READY: 'app:ready',
  APP_BEFORE_QUIT: 'app:before-quit',
  WINDOW_CREATED: 'window:created',
  WINDOW_CLOSED: 'window:closed',
  OPEN_FILE: IPC_CHANNELS.FILES.OPEN_FILE,
  SAVE_FILE: IPC_CHANNELS.FILES.SAVE_FILE,
  CREATE_ENTITY: IPC_CHANNELS.ENTITIES.CREATE_ENTITY,
  UPDATE_ENTITY: IPC_CHANNELS.ENTITIES.UPDATE_ENTITY,
  DELETE_ENTITY: IPC_CHANNELS.ENTITIES.DELETE_ENTITY,
  GET_ENTITY: IPC_CHANNELS.ENTITIES.GET_ENTITY,
  GET_ENTITIES: IPC_CHANNELS.ENTITIES.GET_ENTITIES,
  LOAD_PLUGIN: IPC_CHANNELS.PLUGINS.LOAD_PLUGIN,
  UNLOAD_PLUGIN: IPC_CHANNELS.PLUGINS.UNLOAD_PLUGIN,
  RELOAD_PLUGIN: IPC_CHANNELS.PLUGINS.RELOAD_PLUGIN,
  ACTIVATE_PLUGIN: IPC_CHANNELS.PLUGINS.ACTIVATE_PLUGIN,
  DEACTIVATE_PLUGIN: IPC_CHANNELS.PLUGINS.DEACTIVATE_PLUGIN
} as const

export const PLUGIN_EVENTS = {
  PLUGIN_LOADED: 'plugin:loaded',
  PLUGIN_INITIALIZED: 'plugin:initialized',
  PLUGIN_ACTIVATED: 'plugin:activated',
  PLUGIN_DEACTIVATED: 'plugin:deactivated',
  PLUGIN_ERROR: 'plugin:error',
  PLUGIN_CONFIG_CHANGED: 'plugin:configChanged'
} as const

/**
 * 系统事件类型
 */
export type SystemEventType = (typeof SYSTEM_EVENTS)[keyof typeof SYSTEM_EVENTS]

/**
 * 插件事件类型
 */
export type PluginEventType = (typeof PLUGIN_EVENTS)[keyof typeof PLUGIN_EVENTS]

/**
 * 插件状态转换映射
 * 定义了插件状态之间允许的转换
 */
export const PLUGIN_STATE_TRANSITIONS: Record<PluginLifecycleState, PluginLifecycleState[]> = {
  [PluginLifecycleState.UNLOADED]: [PluginLifecycleState.LOADING, PluginLifecycleState.ERROR],
  [PluginLifecycleState.LOADING]: [PluginLifecycleState.LOADED, PluginLifecycleState.ERROR],
  [PluginLifecycleState.LOADED]: [
    PluginLifecycleState.INITIALIZING,
    PluginLifecycleState.UNLOADED,
    PluginLifecycleState.ERROR
  ],
  [PluginLifecycleState.INITIALIZING]: [
    PluginLifecycleState.INITIALIZED,
    PluginLifecycleState.ERROR
  ],
  [PluginLifecycleState.INITIALIZED]: [
    PluginLifecycleState.ACTIVATING,
    PluginLifecycleState.UNLOADED,
    PluginLifecycleState.ERROR
  ],
  [PluginLifecycleState.ACTIVATING]: [PluginLifecycleState.ACTIVE, PluginLifecycleState.ERROR],
  [PluginLifecycleState.ACTIVE]: [PluginLifecycleState.DEACTIVATING, PluginLifecycleState.ERROR],
  [PluginLifecycleState.DEACTIVATING]: [PluginLifecycleState.INACTIVE, PluginLifecycleState.ERROR],
  [PluginLifecycleState.INACTIVE]: [
    PluginLifecycleState.ACTIVATING,
    PluginLifecycleState.UNLOADED,
    PluginLifecycleState.ERROR
  ],
  [PluginLifecycleState.ERROR]: [PluginLifecycleState.UNLOADED, PluginLifecycleState.LOADING]
}

/**
 * 插件默认配置
 */
export const DEFAULT_PLUGIN_CONFIG: PluginConfiguration = {
  fields: [],
  data: {}
}

/**
 * 插件模板类型
 */
export const PLUGIN_TEMPLATES = {
  TOOL: 'tool',
  VISUALIZATION: 'visualization',
  EDITOR: 'editor',
  INTEGRATION: 'integration',
  THEME: 'theme'
} as const
