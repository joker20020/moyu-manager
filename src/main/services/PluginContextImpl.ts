import * as fs from 'fs/promises'
import * as path from 'path'
import { SystemService } from './SystemService'
import {
  PluginContext,
  PluginEntityAPI,
  PluginFileAPI,
  PluginConfigAPI,
  PluginUIApi,
  PluginUtils,
  PluginStorage,
  PluginLogger,
  PluginEventEmitter,
  SYSTEM_EVENTS,
  PLUGIN_EVENTS,
  PLUGIN_PERMISSIONS as PERMISSIONS
} from '../../shared/types/plugins'

/**
 * 插件上下文实现类
 * 为插件提供受限的API访问环境
 */
export class PluginContextImpl implements PluginContext {
  // 插件信息
  public readonly pluginId: string
  public readonly pluginVersion: string
  public readonly installPath: string
  public isActive: boolean = false

  // API访问（根据权限动态提供）
  public entities?: PluginEntityAPI
  public files?: PluginFileAPI
  public config?: PluginConfigAPI
  public ui?: PluginUIApi

  // 工具函数
  public utils: PluginUtils
  public storage: PluginStorage
  public logger: PluginLogger
  public events: PluginEventEmitter

  // 权限列表
  private permissions: Set<string> = new Set()

  // 服务依赖
  private entityService: any
  private _fileService: any // 保留但未使用（插件文件API使用Node.js fs模块）
  private configService: any
  private uiService?: any
  private systemEventEmitter?: any

  constructor(
    pluginId: string,
    pluginVersion: string,
    installPath: string,
    permissions: string[],
    services: {
      entityService?: any
      fileService?: any
      configService?: any
      uiService?: any
      systemEventEmitter?: any
    }
  ) {
    this.pluginId = pluginId
    this.pluginVersion = pluginVersion
    this.installPath = installPath

    // 设置权限
    permissions.forEach((permission) => this.permissions.add(permission))

    // 存储服务引用
    this.entityService = services.entityService
    this._fileService = services.fileService
    this.configService = services.configService
    this.uiService = services.uiService
    this.systemEventEmitter = services.systemEventEmitter

    // 标记_fileService为已使用（避免TS警告，实际插件文件API使用Node.js fs模块）
    void this._fileService

    // 初始化工具函数
    this.utils = this.createUtils()
    this.storage = this.createStorage()
    this.logger = this.createLogger()
    this.events = this.createEventEmitter()

    // 根据权限初始化API
    this.initializeAPIs()
  }

  /**
   * 检查是否拥有指定权限
   */
  hasPermission(permission: string): boolean {
    return this.permissions.has(permission)
  }

  /**
   * 添加权限（用于动态权限管理）
   */
  addPermission(permission: string): void {
    this.permissions.add(permission)
    this.initializeAPIs() // 重新初始化API
  }

  /**
   * 移除权限
   */
  removePermission(permission: string): void {
    this.permissions.delete(permission)
    this.initializeAPIs() // 重新初始化API
  }

  /**
   * 根据权限初始化API
   */
  private initializeAPIs(): void {
    // 实体API（需要entities权限）
    if (
      this.hasPermission(PERMISSIONS.CREATE_ENTITY) ||
      this.hasPermission(PERMISSIONS.UPDATE_ENTITY) ||
      this.hasPermission(PERMISSIONS.DELETE_ENTITY)
    ) {
      this.entities = this.createEntityAPI()
    } else {
      this.entities = undefined
    }

    // 文件API（需要files权限）
    if (this.hasPermission(PERMISSIONS.OPEN_FILE) || this.hasPermission(PERMISSIONS.SAVE_FILE)) {
      this.files = this.createFileAPI()
    } else {
      this.files = undefined
    }

    // 配置API（需要config权限）
    if (
      this.hasPermission(PERMISSIONS.READ_CONFIG) ||
      this.hasPermission(PERMISSIONS.WRITE_CONFIG)
    ) {
      this.config = this.createConfigAPI()
    } else {
      this.config = undefined
    }

    // UI API（需要ui权限）
    if (this.hasPermission(PERMISSIONS.UI_SHOW) || this.hasPermission(PERMISSIONS.UI_MODIFY)) {
      this.ui = this.createUIApi()
    } else {
      this.ui = undefined
    }
  }

  /**
   * 创建实体API
   */
  private createEntityAPI(): PluginEntityAPI {
    // 如果没有实体服务，返回模拟API
    if (!this.entityService) {
      return this.createMockEntityAPI()
    }

    return {
      getTypes: async () => {
        if (!this.hasPermission(PERMISSIONS.GET_ENTITY_TYPES)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.GET_ENTITY_TYPES}权限`)
        }
        return this.entityService.getEntityTypes()
      },

      getType: async (id: string) => {
        if (!this.hasPermission(PERMISSIONS.GET_ENTITY_TYPE)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.GET_ENTITY_TYPE}权限`)
        }
        return this.entityService.getEntityType(id)
      },

      getEntities: async (query?: any) => {
        if (!this.hasPermission(PERMISSIONS.GET_ENTITIES)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.GET_ENTITIES}权限`)
        }
        return this.entityService.getEntities(query)
      },

      getEntity: async (id: string) => {
        if (!this.hasPermission(PERMISSIONS.GET_ENTITY)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.GET_ENTITY}权限`)
        }
        return this.entityService.getEntity(id)
      },

      createEntity: async (entity: Partial<any>) => {
        if (!this.hasPermission(PERMISSIONS.CREATE_ENTITY)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.CREATE_ENTITY}权限`)
        }
        return this.entityService.createEntity(entity)
      },

      updateEntity: async (id: string, updates: Partial<any>) => {
        if (!this.hasPermission(PERMISSIONS.UPDATE_ENTITY)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.UPDATE_ENTITY}权限`)
        }
        return this.entityService.updateEntity(id, updates)
      },

      deleteEntity: async (id: string) => {
        if (!this.hasPermission(PERMISSIONS.DELETE_ENTITY)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.DELETE_ENTITY}权限`)
        }
        return this.entityService.deleteEntity(id)
      }
    }
  }

  /**
   * 创建文件API
   */
  private createFileAPI(): PluginFileAPI {
    // 解析并验证文件路径，限制在插件安装目录内
    const resolveAndValidatePath = (requestedPath: string): string => {
      // 解析相对路径
      const resolvedPath = path.resolve(this.installPath, requestedPath)
      // 验证路径是否在插件安装目录内（防止目录遍历攻击）
      if (!resolvedPath.startsWith(this.installPath)) {
        throw new Error(`访问被拒绝: 路径 ${requestedPath} 不在插件目录内`)
      }
      return resolvedPath
    }

    return {
      read: async (filePath: string) => {
        if (!this.hasPermission(PERMISSIONS.OPEN_FILE)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.OPEN_FILE}权限`)
        }
        const resolvedPath = resolveAndValidatePath(filePath)
        try {
          return await fs.readFile(resolvedPath, 'utf-8')
        } catch (error) {
          SystemService.logError(error, `pluginContext:${PERMISSIONS.OPEN_FILE}`)
          throw new Error(`读取文件失败: ${error instanceof Error ? error.message : String(error)}`)
        }
      },

      write: async (filePath: string, content: string) => {
        if (!this.hasPermission(PERMISSIONS.SAVE_FILE)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.SAVE_FILE}权限`)
        }
        const resolvedPath = resolveAndValidatePath(filePath)
        try {
          // 确保目录存在
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
          await fs.writeFile(resolvedPath, content, 'utf-8')
        } catch (error) {
          SystemService.logError(error, `pluginContext:${PERMISSIONS.SAVE_FILE}`)
          throw new Error(`写入文件失败: ${error instanceof Error ? error.message : String(error)}`)
        }
      },

      exists: async (filePath: string) => {
        if (!this.hasPermission(PERMISSIONS.OPEN_FILE)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.OPEN_FILE}权限`)
        }
        const resolvedPath = resolveAndValidatePath(filePath)
        try {
          await fs.access(resolvedPath)
          return true
        } catch (error) {
          SystemService.logError(error, `pluginContext:${PERMISSIONS.OPEN_FILE}`)
          return false
        }
      },

      stat: async (filePath: string) => {
        if (!this.hasPermission(PERMISSIONS.OPEN_FILE)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.OPEN_FILE}权限`)
        }
        const resolvedPath = resolveAndValidatePath(filePath)
        try {
          return await fs.stat(resolvedPath)
        } catch (error) {
          SystemService.logError(error, `pluginContext:${PERMISSIONS.OPEN_FILE}`)
          throw new Error(
            `获取文件信息失败: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
    }
  }

  /**
   * 创建配置API
   */
  private createConfigAPI(): PluginConfigAPI {
    // 如果没有配置服务，返回模拟API
    if (!this.configService) {
      return this.createMockConfigAPI()
    }

    return {
      get: async <T = any>(key: string, defaultValue?: T) => {
        if (!this.hasPermission(PERMISSIONS.READ_CONFIG)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.READ_CONFIG}权限`)
        }
        return this.configService.get(key, defaultValue)
      },

      set: async <T = any>(key: string, value: T) => {
        if (!this.hasPermission(PERMISSIONS.WRITE_CONFIG)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.WRITE_CONFIG}权限`)
        }
        return this.configService.set(key, value)
      },

      delete: async (key: string) => {
        if (!this.hasPermission(PERMISSIONS.WRITE_CONFIG)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.WRITE_CONFIG}权限`)
        }
        return this.configService.delete(key)
      }
    }
  }

  /**
   * 创建UI API
   */
  private createUIApi(): PluginUIApi {
    return {
      showNotification: async (options) => {
        if (!this.hasPermission(PERMISSIONS.UI_SHOW)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.UI_SHOW}权限`)
        }
        if (!this.uiService) {
          throw new Error('UI服务不可用')
        }
        // 映射参数类型：PluginUIApi使用'success'|'warning'|'error'|'info'，UIService使用'info'|'warning'|'error'
        const uiServiceType = options.type === 'success' ? 'info' : options.type || 'info'
        return this.uiService.showNotification({
          title: options.title,
          message: options.message,
          type: uiServiceType as 'info' | 'warning' | 'error'
        })
      },

      showDialog: async (options) => {
        if (!this.hasPermission(PERMISSIONS.UI_SHOW)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.UI_SHOW}权限`)
        }
        if (!this.uiService) {
          throw new Error('UI服务不可用')
        }
        // 映射参数类型：PluginUIApi使用'alert'|'confirm'|'prompt'，UIService使用'info'|'warning'|'error'|'question'
        let uiServiceType: 'info' | 'warning' | 'error' | 'question' = 'info'
        if (options.type === 'confirm' || options.type === 'prompt') {
          uiServiceType = 'question'
        } else if (options.type === 'alert') {
          uiServiceType = 'info'
        }
        return this.uiService.showDialog({
          title: options.title,
          message: options.message,
          type: uiServiceType,
          buttons: options.buttons
        })
      },

      openExternal: async (url: string) => {
        if (!this.hasPermission(PERMISSIONS.UI_SHOW)) {
          throw new Error(`权限不足: 需要${PERMISSIONS.UI_SHOW}权限`)
        }
        if (!this.uiService) {
          throw new Error('UI服务不可用')
        }
        return this.uiService.openExternal(url)
      }
    }
  }

  /**
   * 创建工具函数
   */
  private createUtils(): PluginUtils {
    return {
      generateId: () => {
        return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },

      formatDate: (date: Date, format?: string) => {
        if (!format || format === 'default') {
          return date.toISOString()
        }
        // 简单格式化实现
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')

        if (format === 'YYYY-MM-DD') {
          return `${year}-${month}-${day}`
        } else if (format === 'YYYY-MM-DD HH:mm:ss') {
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        }

        return date.toISOString()
      },

      deepClone: <T>(obj: T): T => {
        return JSON.parse(JSON.stringify(obj))
      },

      debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => {
        let timeout: NodeJS.Timeout | null = null
        return (...args: Parameters<T>) => {
          if (timeout) clearTimeout(timeout)
          timeout = setTimeout(() => func(...args), wait)
        }
      },

      throttle: <T extends (...args: any[]) => any>(func: T, wait: number) => {
        let lastCall = 0
        let timeout: NodeJS.Timeout | null = null
        return (...args: Parameters<T>) => {
          const now = Date.now()
          if (now - lastCall >= wait) {
            lastCall = now
            func(...args)
          } else if (!timeout) {
            timeout = setTimeout(
              () => {
                lastCall = Date.now()
                func(...args)
                timeout = null
              },
              wait - (now - lastCall)
            )
          }
        }
      }
    }
  }

  /**
   * 创建存储接口
   */
  private createStorage(): PluginStorage {
    // 使用内存存储（TODO: 实现持久化存储）
    const storage = new Map<string, any>()

    return {
      get: async <T = any>(key: string) => {
        return storage.get(key) as T | null
      },

      set: async <T = any>(key: string, value: T) => {
        storage.set(key, value)
      },

      delete: async (key: string) => {
        storage.delete(key)
      },

      clear: async () => {
        storage.clear()
      },

      keys: async () => {
        return Array.from(storage.keys())
      }
    }
  }

  /**
   * 创建日志器
   */
  private createLogger(): PluginLogger {
    const prefix = `[插件 ${this.pluginId}]`

    return {
      debug: (message: string, ...args: any[]) => {
        console.debug(`${prefix} ${message}`, ...args)
      },

      info: (message: string, ...args: any[]) => {
        console.info(`${prefix} ${message}`, ...args)
      },

      warn: (message: string, ...args: any[]) => {
        console.warn(`${prefix} ${message}`, ...args)
      },

      error: (message: string, ...args: any[]) => {
        console.error(`${prefix} ${message}`, ...args)
      }
    }
  }

  /**
   * 创建事件发射器
   */
  private createEventEmitter(): PluginEventEmitter {
    const systemListeners = new Map<string, (...args: any[]) => void>()

    const isSystemEvent = (event: string): boolean => {
      // 系统事件以 system: 开头
      if (event.startsWith('system:')) {
        return true
      }
      // 插件管理器事件以 plugin: 开头但不包含当前插件ID
      if (event.startsWith('plugin:') && !event.startsWith(`plugin:${this.pluginId}:`)) {
        return true
      }
      // 内置事件常量
      const knownSystemEvents = [
        ...Object.values(SYSTEM_EVENTS),
        ...Object.values(PLUGIN_EVENTS)
      ] as string[]
      return knownSystemEvents.includes(event)
    }

    const createSystemListener = (event: string, originalListener: (data?: any) => void) => {
      return (data?: any) => {
        // 权限检查
        if (!this.hasPermission(PERMISSIONS.EVENTS_SUBSCRIBE)) {
          this.logger.warn(
            `插件尝试监听系统事件 ${event} 但没有 ${PERMISSIONS.EVENTS_SUBSCRIBE} 权限`
          )
          return
        }
        originalListener(data)
      }
    }

    return {
      on: (event: string, listener: (data?: any) => void) => {
        // 转发到系统事件发射器
        if (this.systemEventEmitter && this.hasPermission(PERMISSIONS.EVENTS_SUBSCRIBE)) {
          const systemListener = createSystemListener(event, listener)
          systemListeners.set(`${event}:${listener.toString()}`, systemListener)
          this.systemEventEmitter.on(event, systemListener)
        }
        return listener
      },

      once: (event: string, listener: (data?: any) => void) => {
        // 转发到系统事件发射器
        if (this.systemEventEmitter && this.hasPermission(PERMISSIONS.EVENTS_SUBSCRIBE)) {
          const systemListener = createSystemListener(event, listener)
          systemListeners.set(`${event}:${listener.toString()}`, systemListener)
          this.systemEventEmitter.once(event, systemListener)
        }
        return listener
      },

      off: (event: string, listener: (data?: any) => void) => {
        // 从系统事件发射器移除
        if (this.systemEventEmitter && this.hasPermission(PERMISSIONS.EVENTS_SUBSCRIBE)) {
          const key = `${event}:${listener.toString()}`
          const systemListener = systemListeners.get(key)
          if (systemListener) {
            this.systemEventEmitter.off(event, systemListener)
            systemListeners.delete(key)
          }
        }
        return listener
      },

      emit: (event: string, data?: any) => {
        if (
          !isSystemEvent(event) &&
          this.systemEventEmitter &&
          this.hasPermission(PERMISSIONS.EVENTS_SUBSCRIBE)
        ) {
          this.systemEventEmitter.emit(event, data)
        }
      }
    }
  }

  /**
   * 创建模拟实体API（用于测试或未提供实体服务时）
   */
  private createMockEntityAPI(): PluginEntityAPI {
    return {
      getTypes: async () => [],
      getType: async () => {
        throw new Error('实体服务未提供')
      },
      getEntities: async () => [],
      getEntity: async () => {
        throw new Error('实体服务未提供')
      },
      createEntity: async () => {
        throw new Error('实体服务未提供')
      },
      updateEntity: async () => {
        throw new Error('实体服务未提供')
      },
      deleteEntity: async () => false
    }
  }

  /**
   * 创建模拟配置API
   */
  private createMockConfigAPI(): PluginConfigAPI {
    const storage = new Map<string, any>()

    return {
      get: async <T = any>(key: string, defaultValue?: T) => {
        return storage.get(key) ?? defaultValue
      },

      set: async <T = any>(key: string, value: T) => {
        storage.set(key, value)
      },

      delete: async (key: string) => {
        storage.delete(key)
      }
    }
  }

  /**
   * 激活插件上下文
   */
  activate(): void {
    this.isActive = true
    this.logger.info('插件上下文已激活')
  }

  /**
   * 停用插件上下文
   */
  deactivate(): void {
    this.isActive = false
    this.logger.info('插件上下文已停用')
  }
}
