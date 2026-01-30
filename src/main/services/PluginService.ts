import { join } from 'path'
import { EventEmitter } from 'events'
import fs from 'fs'
import { access } from 'fs/promises'
import { dialog, shell, Notification } from 'electron'
import {
  Plugin,
  PluginManifest,
  PluginLifecycleState,
  PluginPermission,
  PluginRuntimeConfig,
  PluginOperationResult,
  DEFAULT_RUNTIME_CONFIG,
  PLUGIN_STATE_TRANSITIONS,
  SYSTEM_EVENTS,
  PLUGIN_EVENTS,
  PLUGIN_MANIFEST_FILE
} from '../../shared/types/plugins'
import { PluginLoader } from './PluginLoader'
import { PluginContextImpl } from './PluginContextImpl'
import { GitService } from './GitService'
import type { ConfigService } from './ConfigService'
import type { EntityService } from './EntityService'
import type { FileService } from './FileService'
import { SystemService } from './SystemService'


/**
 * UI服务 - 提供插件UI操作接口
 */
class UIService {
  /**
   * 显示通知
   */
  async showNotification(options: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error'
  }): Promise<void> {
    // 使用Electron的通知API
    const notification = new Notification({
      title: options.title,
      body: options.message,
      silent: options.type === 'info'
    })
    notification.show()
  }

  /**
   * 显示对话框
   */
  async showDialog(options: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'question'
    buttons?: string[]
  }): Promise<any> {
    const result = await dialog.showMessageBox({
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      buttons: options.buttons || ['确定']
    })
    return result
  }

  /**
   * 打开外部链接
   */
  async openExternal(url: string): Promise<void> {
    await shell.openExternal(url)
  }
}

/**
 * 插件服务 - 负责插件生命周期管理和状态机
 * 遵循实体管理程序的开发需求说明中的插件系统设计
 */
export class PluginService {
  // 插件注册表: pluginId -> Plugin
  private plugins: Map<string, Plugin> = new Map()

  // 事件发射器（用于系统事件和插件事件）
  private eventEmitter: EventEmitter = new EventEmitter()

  // 事件订阅存储
  private subscriptions: Map<string, { event: string; callback: (...args: any[]) => void }> =
    new Map()

  // 服务依赖（通过构造函数注入）
  private entityService: EntityService
  private fileService: FileService
  private configService: ConfigService
  private uiService: UIService
  private gitService: GitService

  // 插件加载器
  private pluginLoader: PluginLoader = new PluginLoader()

  constructor(
    configService?: ConfigService,
    entityService?: EntityService,
    fileService?: FileService,
    uiService?: UIService,
    gitService?: GitService
  ) {
    // 存储服务依赖
    this.configService = configService as ConfigService
    this.entityService = entityService as EntityService
    this.fileService = fileService as FileService
    this.uiService = uiService || new UIService()
    this.gitService = gitService || new GitService()

    this.initializeEventSystem()
    // this.initializeDefaultPlugins()
    // this.discoverPlugins()
    // 启用插件沙箱（默认开启以提高安全性）
    this.pluginLoader.enableSandbox()
  }

  /**
   * 初始化事件系统
   */
  private initializeEventSystem(): void {
    // 监听系统事件
    this.eventEmitter.on(SYSTEM_EVENTS.APP_READY, () => {
      this.onAppReady()
    })

    this.eventEmitter.on(SYSTEM_EVENTS.APP_BEFORE_QUIT, () => {
      this.onAppBeforeQuit()
    })
  }

  /**
   * 扫描插件目录并注册已安装的插件
   */
  async discoverPlugins(): Promise<void> {
    // 扫描所有插件目录
    const discovered = await this.pluginLoader.scanForPlugins()

    for (const { manifest, directory } of discovered) {
      const pluginId = manifest.id

      // 如果插件已存在，跳过
      if (this.plugins.has(pluginId)) {
        continue
      }

      // 读取运行时配置
      let runtimeConfig: PluginRuntimeConfig
      try {
        runtimeConfig = await this.pluginLoader.loadPluginConfig(directory)
      } catch (error) {
        console.warn(`加载插件 ${pluginId} 配置失败，使用默认配置:`, error)
        SystemService.logError(error, `pluginService:discoverPlugins`)
        runtimeConfig = { ...DEFAULT_RUNTIME_CONFIG }
      }

      const plugin: Plugin = {
        manifest,
        installPath: directory,
        installedAt: Date.now(),
        state: PluginLifecycleState.UNLOADED,
        enabled: runtimeConfig.enabled,
        runtimeConfig
      }

      this.plugins.set(pluginId, plugin)
    }
  }

  /**
   * 检查状态转换是否合法
   */
  private canTransition(
    currentState: PluginLifecycleState,
    targetState: PluginLifecycleState
  ): boolean {
    const allowedTransitions = PLUGIN_STATE_TRANSITIONS[currentState]
    return allowedTransitions.includes(targetState)
  }

  /**
   * 更新插件状态（带状态机验证）
   */
  private updatePluginState(
    pluginId: string,
    newState: PluginLifecycleState,
    error?: Error
  ): PluginOperationResult {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      return {
        success: false,
        message: `插件 ${pluginId} 不存在`,
        pluginId
      }
    }

    // 检查状态转换是否合法
    if (!this.canTransition(plugin.state, newState)) {
      return {
        success: false,
        message: `无法从状态 ${plugin.state} 转换到 ${newState}`,
        pluginId
      }
    }

    // 更新状态
    const oldState = plugin.state
    plugin.state = newState

    // 记录错误信息
    if (error) {
      plugin.error = {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      }
    } else {
      delete plugin.error
    }

    // 触发状态变更事件
    this.eventEmitter.emit('plugin:state-changed', {
      pluginId,
      oldState,
      newState,
      timestamp: Date.now()
    })

    return {
      success: true,
      message: `插件状态已从 ${oldState} 更新为 ${newState}`,
      pluginId,
      data: { oldState, newState }
    }
  }

  /**
   * 获取插件配置
   */
  private async getPluginConfig(): Promise<{ autoCheckUpdates: boolean; autoUpdate: boolean }> {
    try {
      if (!this.configService) {
        console.warn('ConfigService未初始化，使用默认配置')
        return { autoCheckUpdates: true, autoUpdate: false }
      }

      // 使用getCategoryConfig获取结构化插件配置
      const pluginsConfig = this.configService.getCategoryConfig('plugins')

      return {
        autoCheckUpdates: pluginsConfig.autoCheckUpdates !== false,
        autoUpdate: pluginsConfig.autoUpdate === true
      }
    } catch (error) {
      console.error('获取插件配置失败:', error)
      return { autoCheckUpdates: true, autoUpdate: false }
    }
  }

  /**
   * 自动检查并更新插件
   */
  private async autoCheckAndUpdatePlugins(): Promise<void> {
    try {
      const config = await this.getPluginConfig()

      // 检查是否需要自动检查更新
      if (!config.autoCheckUpdates) {
        console.log('自动检查更新已禁用')
        return
      }

      console.log('开始自动检查插件更新...')

      // 检查git是否可用
      const gitAvailable = await this.gitService.checkGitAvailability()
      if (!gitAvailable) {
        console.warn('Git不可用，跳过自动更新检查')
        await this.uiService.showNotification({
          title: 'Git不可用',
          message: 'Git未安装或不在PATH中，无法检查插件更新。请安装Git并确保它在PATH中。',
          type: 'warning'
        })
        return
      }

      // 检查更新
      const updates = await this.checkUpdates()

      if (updates.length === 0) {
        console.log('所有插件都是最新版本')
        if (config.autoCheckUpdates) {
          await this.uiService.showNotification({
            title: '插件更新检查',
            message: '所有插件都是最新版本',
            type: 'info'
          })
        }
        return
      }

      console.log(`发现 ${updates.length} 个插件有更新`)

      // 显示更新通知
      await this.uiService.showNotification({
        title: '发现插件更新',
        message: `有 ${updates.length} 个插件可以更新`,
        type: 'info'
      })

      // 如果需要自动更新
      if (config.autoUpdate) {
        console.log('开始自动更新插件...')
        await this.uiService.showNotification({
          title: '插件自动更新',
          message: '正在自动更新插件...',
          type: 'info'
        })

        let successCount = 0
        let failCount = 0

        for (const update of updates) {
          try {
            const result = await this.updatePluginFromGit(update.pluginId)
            if (result.success) {
              successCount++
              console.log(`插件 ${update.pluginId} 更新成功: ${result.message}`)
            } else {
              failCount++
              console.error(`插件 ${update.pluginId} 更新失败: ${result.message}`)
            }
          } catch (error) {
            failCount++
            console.error(`插件 ${update.pluginId} 更新异常:`, error)
          }
        }

        // 显示更新结果
        const message = `更新完成: ${successCount} 个成功, ${failCount} 个失败`
        console.log(message)
        await this.uiService.showNotification({
          title: '插件自动更新完成',
          message,
          type: successCount > 0 && failCount === 0 ? 'info' : 'warning'
        })
      } else {
        // 仅通知，不自动更新
        const pluginNames = updates.map((u) => u.pluginId).join(', ')
        await this.uiService.showNotification({
          title: '发现插件更新',
          message: `插件 ${pluginNames} 有新版本可用。请在插件管理页面手动更新。`,
          type: 'info'
        })
      }
    } catch (error) {
      console.error('自动检查更新失败:', error)
      // 不显示错误通知，避免干扰用户
    }
  }

  /**
   * 应用准备就绪时的处理
   */
  private async onAppReady(): Promise<void> {
    try {
      // 扫描插件目录并注册已安装的插件
      await this.discoverPlugins()
    } catch (error) {
      console.error('扫描插件目录失败:', error)
      // 继续执行，不影响已存在的插件
    }

    // 自动加载已启用的插件
    const enabledPlugins = Array.from(this.plugins.entries()).filter(([, plugin]) => plugin.enabled)
    for (const [pluginId, _plugin] of enabledPlugins) {
      try {
        await this.loadPlugin(pluginId)
        await this.initPlugin(pluginId)
        await this.enablePlugin(pluginId)
      } catch (error) {
        console.error(`加载插件 ${pluginId} 失败:`, error)
      }
    }

    // 延迟后自动检查插件更新，让应用完全启动
    setTimeout(() => {
      this.autoCheckAndUpdatePlugins().catch((error) => {
        console.error('自动检查更新失败:', error)
      })
    }, 5000) // 5秒延迟
  }

  /**
   * 应用退出前的处理
   */
  private onAppBeforeQuit(): void {
    // 停用所有激活的插件
    this.plugins.forEach((plugin, pluginId) => {
      if (plugin.state === PluginLifecycleState.ACTIVE) {
        this.deactivatePlugin(pluginId)
      }
    })
  }

  // ==================== 公共API方法（实现EntityManagerAPI.plugins接口） ====================

  /**
   * 获取所有插件
   */
  async getPlugins(): Promise<Plugin[]> {
    return Array.from(this.plugins.values()).map((plugin) => ({
      ...plugin,
      instance: undefined,
      context: undefined
    }))
  }

  /**
   * 获取指定插件
   */
  async getPlugin(id: string): Promise<Plugin | null> {
    const plugin = this.plugins.get(id) || null
    if (plugin) {
      plugin.instance = undefined
      plugin.context = undefined
    }
    return plugin
  }

  /**
   * 安装插件,放入plugins列表
   */
  async installPlugin(source: string, manifest?: PluginManifest): Promise<Plugin> {
    // 检查是否为git URL
    if (this.isGitUrl(source)) {
      return this.installPluginFromGit(source, manifest)
    }

    // 如果提供了清单，使用提供的清单；否则从源目录解析清单
    let pluginManifest: PluginManifest

    if (manifest) {
      pluginManifest = manifest
    } else {
      // 尝试从源目录解析插件清单
      try {
        const manifestPath = join(source, PLUGIN_MANIFEST_FILE)
        pluginManifest = await this.pluginLoader.parseManifest(manifestPath)
      } catch (error) {
        throw new Error(`无法解析插件清单: ${(error as Error).message}`)
      }
    }

    const pluginId = pluginManifest.id

    // 检查插件是否已存在
    if (this.plugins.has(pluginId)) {
      throw new Error(`插件 ${pluginId} 已安装`)
    }

    // 检查插件冲突
    const installedManifests = new Map<string, PluginManifest>()
    this.plugins.forEach((plugin, id) => {
      if (plugin.manifest) {
        installedManifests.set(id, plugin.manifest)
      }
    })
    const conflicts = this.pluginLoader.checkConflicts(pluginManifest, installedManifests)
    if (conflicts.length > 0) {
      throw new Error(`插件冲突: ${conflicts.join(', ')}`)
    }

    // 安装插件文件到用户插件目录
    let installPath: string
    try {
      installPath = await this.pluginLoader.installPluginFiles(source, pluginId, 'user')
    } catch (error) {
      throw new Error(`安装插件文件失败: ${(error as Error).message}`)
    }

    const runtimeConfig = { ...DEFAULT_RUNTIME_CONFIG }

    const plugin: Plugin = {
      manifest: pluginManifest,
      installPath,
      installedAt: Date.now(),
      state: PluginLifecycleState.UNLOADED,
      enabled: runtimeConfig.enabled,
      runtimeConfig
    }

    this.plugins.set(pluginId, plugin)

    // 触发插件安装事件
    this.eventEmitter.emit(PLUGIN_EVENTS.PLUGIN_LOADED, {
      pluginId,
      manifest: pluginManifest
    })

    return plugin
  }

  /**
   * 从Git仓库安装插件
   */
  private async installPluginFromGit(gitUrl: string, manifest?: PluginManifest): Promise<Plugin> {
    // 检查git是否可用
    const gitAvailable = await this.gitService.checkGitAvailability()
    if (!gitAvailable) {
      throw new Error('Git未安装或不在PATH中。无法从git仓库安装插件。请安装Git并确保它在PATH中。')
    }

    // 克隆到临时目录
    let tempDir: string | undefined
    try {
      const cloneResult = await this.gitService.cloneRepository(gitUrl)
      tempDir = cloneResult.path

      // 使用现有安装逻辑
      const plugin = await this.installPlugin(tempDir, manifest)

      // 记录git信息到插件清单
      if (!plugin.manifest.repository) {
        plugin.manifest.repository = gitUrl
      }

      // 存储git信息到运行时配置
      if (plugin.runtimeConfig) {
        plugin.runtimeConfig.customConfig = {
          ...plugin.runtimeConfig.customConfig,
          gitCommit: cloneResult.commit,
          gitUrl,
          clonedAt: Date.now()
        }
      }

      return plugin
    } catch (error) {
      throw new Error(`从Git仓库安装插件失败: ${(error as Error).message}`)
    } finally {
      // 清理临时目录
      if (tempDir) {
        await this.gitService.cleanupTempDirectory(tempDir).catch((error) => {
          console.warn(`清理临时目录失败: ${tempDir}`, error)
        })
      }
    }
  }

  /**
   * 从Git仓库更新插件
   */
  async updatePluginFromGit(pluginId: string): Promise<PluginOperationResult> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      return {
        success: false,
        message: `插件 ${pluginId} 不存在`,
        pluginId
      }
    }

    // 检查插件是否有git仓库
    const hasGitRepo = await this.hasGitRepository(plugin)
    if (!hasGitRepo) {
      return {
        success: false,
        message: '插件未关联git仓库',
        pluginId
      }
    }

    // 检查git是否可用
    const gitAvailable = await this.gitService.checkGitAvailability()
    if (!gitAvailable) {
      return {
        success: false,
        message: 'Git不可用，无法更新插件',
        pluginId
      }
    }

    try {
      // 拉取更新
      const pullResult = await this.gitService.pullUpdates(plugin.installPath)

      if (pullResult.success && pullResult.changes.length > 0) {
        // 重新加载插件以应用更新
        return await this.reloadPlugin(pluginId)
      }

      return {
        success: true,
        message: pullResult.message || '插件已是最新版本',
        pluginId
      }
    } catch (error) {
      return {
        success: false,
        message: `更新失败: ${(error as Error).message}`,
        pluginId
      }
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id)
    if (!plugin) return false

    // 如果插件已加载，先卸载
    if (plugin.state !== PluginLifecycleState.UNLOADED) {
      await this.unloadPlugin(id)
    }
    fs.rmSync(plugin.installPath, { recursive: true, force: true })

    return this.plugins.delete(id)
  }

  /**
   * 启用插件
   */
  async enablePlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id)
    if (!plugin) return false

    plugin.enabled = true

    // 保存启用状态到配置文件
    try {
      await this.savePluginRuntimeConfig(id, { enabled: true })
    } catch (error) {
      console.error(`保存插件 ${id} 启用状态失败:`, error)
      // 继续执行，内存状态已更新
    }

    // 如果插件未加载，自动加载
    if (plugin.state === PluginLifecycleState.UNLOADED) {
      await this.loadPlugin(id)
      await this.initPlugin(id)
    }

    await this.activatePlugin(id)
    return true
  }

  /**
   * 禁用插件
   */
  async disablePlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id)
    if (!plugin) return false

    plugin.enabled = false

    // 保存禁用状态到配置文件
    try {
      await this.savePluginRuntimeConfig(id, { enabled: false })
    } catch (error) {
      console.error(`保存插件 ${id} 禁用状态失败:`, error)
      // 继续执行，内存状态已更新
    }

    // 如果插件已激活，先停用
    if (plugin.state === PluginLifecycleState.ACTIVE) {
      await this.deactivatePlugin(id)
    }

    return true
  }

  // ==================== 插件生命周期管理 ====================

  /**
   * 加载插件（从UNLOADED到LOADED）
   */
  async loadPlugin(id: string): Promise<PluginOperationResult> {
    // 更新状态为加载中
    const loadingResult = this.updatePluginState(id, PluginLifecycleState.LOADING)
    if (!loadingResult.success) return loadingResult

    try {
      const plugin = this.plugins.get(id)
      if (!plugin) {
        return {
          success: false,
          message: `插件 ${id} 不存在`,
          pluginId: id
        }
      }

      // 验证插件目录是否存在
      try {
        await access(plugin.installPath)
      } catch (error) {
        throw new Error(`插件目录不存在: ${plugin.installPath}`)
      }

      // 加载成功，更新状态为已加载
      const loadedResult = this.updatePluginState(id, PluginLifecycleState.LOADED)

      // 触发插件加载完成事件
      this.eventEmitter.emit(PLUGIN_EVENTS.PLUGIN_LOADED, {
        pluginId: id,
        manifest: plugin.manifest
      })

      return loadedResult
    } catch (error) {
      // 加载失败，更新状态为错误
      const errorResult = this.updatePluginState(id, PluginLifecycleState.ERROR, error as Error)
      return {
        ...errorResult,
        error: (error as Error).message
      }
    }
  }

  /**
   * 卸载插件（从任意状态到UNLOADED）
   */
  async unloadPlugin(id: string): Promise<PluginOperationResult> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      return {
        success: false,
        message: `插件 ${id} 不存在`,
        pluginId: id
      }
    }

    // 根据当前状态决定卸载流程
    switch (plugin.state) {
      case PluginLifecycleState.ACTIVE:
        // 先停用
        await this.deactivatePlugin(id)
      // 继续卸载流程
      case PluginLifecycleState.INACTIVE:
      case PluginLifecycleState.INITIALIZED:
        // 可以卸载
        break
      case PluginLifecycleState.UNLOADED:
        // 已经是卸载状态
        return {
          success: true,
          message: '插件已经是卸载状态',
          pluginId: id
        }
      default:
        // 其他状态需要先处理
        return {
          success: false,
          message: `插件当前状态 ${plugin.state} 不允许直接卸载`,
          pluginId: id
        }
    }

    try {
      // 实际卸载插件：清理实例和上下文
      // 插件文件保留在磁盘上，仅从内存卸载

      // 更新状态为卸载
      const result = this.updatePluginState(id, PluginLifecycleState.UNLOADED)

      // 清理插件实例和上下文
      delete plugin.instance
      delete plugin.context

      return result
    } catch (error) {
      // 卸载失败，更新状态为错误
      const errorResult = this.updatePluginState(id, PluginLifecycleState.ERROR, error as Error)
      return {
        ...errorResult,
        error: (error as Error).message
      }
    }
  }

  /**
   * 初始化插件（从LOADED到INITIALIZED）
   */
  async initPlugin(id: string): Promise<PluginOperationResult> {
    // 检查插件状态
    const plugin = this.plugins.get(id)

    if (!plugin) {
      return {
        success: false,
        message: `插件 ${id} 不存在`,
        pluginId: id
      }
    }
    if (plugin.state !== PluginLifecycleState.LOADED) {
      return {
        success: false,
        message: `插件当前状态 ${plugin.state} 不允许初始化`,
        pluginId: id
      }
    }

    // 更新状态为初始化中
    const initResult = this.updatePluginState(id, PluginLifecycleState.INITIALIZING)
    if (!initResult.success) return initResult

    try {
      // 创建插件上下文
      const permissions = plugin.runtimeConfig?.grantedPermissions || []
      plugin.context = new PluginContextImpl(
        plugin.manifest.id,
        plugin.manifest.version,
        plugin.installPath,
        permissions,
        {
          entityService: this.entityService,
          fileService: this.fileService,
          configService: this.configService,
          uiService: this.uiService,
          systemEventEmitter: this.eventEmitter
        }
      )
      // 实际加载插件模块（通过PluginLoader）
      // 注意：我们传递一个空的上下文API给沙箱，插件将通过activate方法接收完整的上下文
      plugin.instance = await this.pluginLoader.loadPluginModule(
        plugin.installPath,
        plugin.manifest,
        {} // 空的上下文API，沙箱将只提供基础的JavaScript全局对象
      )

      // 初始化成功，更新状态为已初始化
      const initializedResult = this.updatePluginState(id, PluginLifecycleState.INITIALIZED)

      // 触发插件初始化完成事件
      this.eventEmitter.emit(PLUGIN_EVENTS.PLUGIN_INITIALIZED, {
        pluginId: id
      })

      return initializedResult
    } catch (error) {
      // 初始化失败，更新状态为错误
      const errorResult = this.updatePluginState(id, PluginLifecycleState.ERROR, error as Error)
      console.error(`插件初始化失败: ${(error as Error).message}`)
      return {
        ...errorResult,
        error: (error as Error).message
      }
    }
  }

  /**
   * 激活插件（从INITIALIZED到ACTIVE）
   */
  async activatePlugin(id: string): Promise<PluginOperationResult> {
    // 检查插件状态
    const plugin = this.plugins.get(id)
    if (!plugin) {
      return {
        success: false,
        message: `插件 ${id} 不存在`,
        pluginId: id
      }
    }

    if (
      plugin.state !== PluginLifecycleState.INITIALIZED &&
      plugin.state !== PluginLifecycleState.INACTIVE
    ) {
      return {
        success: false,
        message: `插件当前状态 ${plugin.state} 不允许激活`,
        pluginId: id
      }
    }

    // 更新状态为激活中
    const activatingResult = this.updatePluginState(id, PluginLifecycleState.ACTIVATING)
    if (!activatingResult.success) return activatingResult

    try {
      // 激活插件上下文
      if (plugin.context) {
        plugin.context.activate()
        plugin.context.isActive = true
      }

      // 实际激活插件：调用插件的activate方法（如果存在）
      if (plugin.instance && typeof plugin.instance.activate === 'function') {
        await plugin.instance.activate(plugin.context)
      }

      // TODO: 注册插件声明的命令、视图和菜单（需要相应的服务支持）
      // if (plugin.manifest.commands) { ... }
      // if (plugin.manifest.views) { ... }
      // if (plugin.manifest.menus) { ... }

      // 激活成功，更新状态为已激活
      const activatedResult = this.updatePluginState(id, PluginLifecycleState.ACTIVE)

      // 触发插件激活完成事件
      this.eventEmitter.emit(PLUGIN_EVENTS.PLUGIN_ACTIVATED, {
        pluginId: id
      })

      return activatedResult
    } catch (error) {
      // 激活失败，更新状态为错误
      console.error(`插件激活失败: ${(error as Error).message}`)
      const errorResult = this.updatePluginState(id, PluginLifecycleState.ERROR, error as Error)
      return {
        ...errorResult,
        error: (error as Error).message
      }
    }
  }

  /**
   * 停用插件（从ACTIVE到INACTIVE）
   */
  async deactivatePlugin(id: string): Promise<PluginOperationResult> {
    // 检查插件状态
    const plugin = this.plugins.get(id)
    if (!plugin) {
      return {
        success: false,
        message: `插件 ${id} 不存在`,
        pluginId: id
      }
    }

    if (plugin.state !== PluginLifecycleState.ACTIVE) {
      return {
        success: false,
        message: `插件当前状态 ${plugin.state} 不允许停用`,
        pluginId: id
      }
    }

    // 更新状态为停用中
    const deactivatingResult = this.updatePluginState(id, PluginLifecycleState.DEACTIVATING)
    if (!deactivatingResult.success) return deactivatingResult

    try {
      // 实际停用插件：调用插件的deactivate方法（如果存在）
      if (plugin.instance && typeof plugin.instance.deactivate === 'function') {
        await plugin.instance.deactivate(plugin.context)
      }

      // 停用插件上下文
      if (plugin.context) {
        plugin.context.deactivate()
        plugin.context.isActive = false
      }

      // TODO: 清理插件注册的命令、视图和菜单（需要相应的服务支持）
      // 例如：注销命令、移除视图等

      // 停用成功，更新状态为已停用
      const deactivatedResult = this.updatePluginState(id, PluginLifecycleState.INACTIVE)

      // 触发插件停用完成事件
      this.eventEmitter.emit(PLUGIN_EVENTS.PLUGIN_DEACTIVATED, {
        pluginId: id
      })

      return deactivatedResult
    } catch (error) {
      // 停用失败，更新状态为错误
      const errorResult = this.updatePluginState(id, PluginLifecycleState.ERROR, error as Error)
      return {
        ...errorResult,
        error: (error as Error).message
      }
    }
  }

  /**
   * 获取插件状态
   */
  async getPluginState(id: string): Promise<PluginLifecycleState> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      throw new Error(`插件 ${id} 不存在`)
    }
    return plugin.state
  }

  /**
   * 重新加载插件（完整的生命周期：卸载 -> 加载 -> 初始化 -> 激活）
   */
  async reloadPlugin(id: string): Promise<PluginOperationResult> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      return {
        success: false,
        message: `插件 ${id} 不存在`,
        pluginId: id
      }
    }

    const results: PluginOperationResult[] = []

    // 记录原始状态
    const originalState = plugin.state
    const wasEnabled = plugin.enabled

    try {
      // 如果插件已激活，先停用
      if (plugin.state === PluginLifecycleState.ACTIVE) {
        const deactivateResult = await this.deactivatePlugin(id)
        results.push(deactivateResult)
        if (!deactivateResult.success) {
          return {
            success: false,
            message: `停用插件失败: ${deactivateResult.message}`,
            pluginId: id,
            data: { results }
          }
        }
      }

      // 如果插件已加载，先卸载
      if (plugin.state !== PluginLifecycleState.UNLOADED) {
        const unloadResult = await this.unloadPlugin(id)
        results.push(unloadResult)
        if (!unloadResult.success) {
          return {
            success: false,
            message: `卸载插件失败: ${unloadResult.message}`,
            pluginId: id,
            data: { results }
          }
        }
      }

      // 重新加载插件
      if (wasEnabled) {
        const loadResult = await this.loadPlugin(id)
        results.push(loadResult)
        if (!loadResult.success) {
          return {
            success: false,
            message: `加载插件失败: ${loadResult.message}`,
            pluginId: id,
            data: { results }
          }
        }

        const initResult = await this.initPlugin(id)
        results.push(initResult)
        if (!initResult.success) {
          return {
            success: false,
            message: `初始化插件失败: ${initResult.message}`,
            pluginId: id,
            data: { results }
          }
        }

        const activateResult = await this.activatePlugin(id)
        results.push(activateResult)
        if (!activateResult.success) {
          return {
            success: false,
            message: `激活插件失败: ${activateResult.message}`,
            pluginId: id,
            data: { results }
          }
        }
      }

      return {
        success: true,
        message: `插件 ${id} 重载成功`,
        pluginId: id,
        data: { results, originalState, finalState: plugin.state }
      }
    } catch (error) {
      return {
        success: false,
        message: `重载插件时发生错误: ${(error as Error).message}`,
        error: (error as Error).message,
        pluginId: id,
        data: { results }
      }
    }
  }

  // ==================== 向后兼容的方法 ====================

  /**
   * 获取市场插件（模拟数据）
   */
  async getMarketPlugins(query?: string): Promise<any[]> {
    // 模拟数据
    const plugins = [
      {
        id: 'market_1',
        name: '图表插件',
        description: '提供各种图表组件',
        version: '1.0.0',
        category: 'visualization',
        author: '图表团队',
        compatibility: '>=1.0.0',
        license: 'MIT'
      },
      {
        id: 'market_2',
        name: '导入导出插件',
        description: '支持多种格式导入导出',
        version: '1.0.0',
        category: 'tool',
        author: '工具团队',
        compatibility: '>=1.0.0',
        license: 'MIT'
      },
      {
        id: 'market_3',
        name: 'AI助手',
        description: 'AI辅助实体管理',
        version: '1.0.0',
        category: 'tool',
        author: 'AI团队',
        compatibility: '>=1.0.0',
        license: 'MIT'
      }
    ]

    // 简单的查询过滤
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase()
      return plugins.filter(
        (plugin) =>
          plugin.name.toLowerCase().includes(searchTerm) ||
          plugin.description.toLowerCase().includes(searchTerm) ||
          plugin.category.toLowerCase().includes(searchTerm)
      )
    }

    return plugins
  }

  /**
   * 检查更新
   */
  async checkUpdates(): Promise<
    Array<{ pluginId: string; currentVersion: string; latestVersion: string; changelog?: string }>
  > {
    const updates: Array<{
      pluginId: string
      currentVersion: string
      latestVersion: string
      changelog?: string
    }> = []

    // 检查git是否可用
    const gitAvailable = await this.gitService.checkGitAvailability()
    if (!gitAvailable) {
      console.warn('Git不可用，跳过git仓库更新检查')
      // 返回空数组，不显示错误，允许其他更新检查继续
    }

    for (const [pluginId, plugin] of this.plugins.entries()) {
      try {
        // 检查插件是否有git仓库
        const hasGitRepo = await this.hasGitRepository(plugin)
        if (!hasGitRepo) {
          continue
        }

        // 检查git更新
        const updateInfo = await this.gitService.checkForUpdates(plugin.installPath)

        if (updateInfo.hasUpdates && updateInfo.remoteCommit) {
          updates.push({
            pluginId,
            currentVersion: plugin.manifest.version,
            latestVersion: updateInfo.remoteCommit.substring(0, 8), // 使用短提交哈希作为版本
            changelog: `有 ${updateInfo.behind} 个提交待更新`
          })
        }
      } catch (error) {
        console.warn(`检查插件 ${pluginId} 更新失败:`, error)
        // 忽略单个插件检查失败，继续检查其他插件
      }
    }

    return updates
  }

  /**
   * 检查插件是否有git仓库
   */
  private async hasGitRepository(plugin: Plugin): Promise<boolean> {
    // 首先检查插件清单中是否有repository字段
    if (plugin.manifest.repository) {
      return true
    }

    // 然后检查插件安装目录是否是git仓库
    return await this.gitService.isGitRepository(plugin.installPath)
  }

  /**
   * 检查字符串是否为git URL
   */
  private isGitUrl(source: string): boolean {
    return this.gitService.isValidGitUrl(source)
  }

  /**
   * 更新插件
   */
  async updatePlugin(id: string): Promise<boolean> {
    // 模拟更新
    const plugin = this.plugins.get(id)
    if (plugin) {
      plugin.updatedAt = Date.now()
    }
    return true
  }

  /**
   * 重新加载所有插件（向后兼容）
   */
  async reloadPlugins(): Promise<void> {
    // 停用所有激活的插件
    for (const [pluginId, plugin] of Array.from(this.plugins.entries())) {
      if (plugin.state === PluginLifecycleState.ACTIVE) {
        await this.deactivatePlugin(pluginId)
      }
    }

    // 卸载所有已加载的插件
    for (const [pluginId, plugin] of Array.from(this.plugins.entries())) {
      if (plugin.state !== PluginLifecycleState.UNLOADED) {
        await this.unloadPlugin(pluginId)
      }
    }

    // 重新加载已启用的插件
    for (const [pluginId, plugin] of Array.from(this.plugins.entries())) {
      if (plugin.enabled) {
        await this.loadPlugin(pluginId)
        await this.initPlugin(pluginId)
        await this.activatePlugin(pluginId)
      }
    }
  }

  // ==================== 事件系统方法 ====================

  /**
   * 订阅事件
   */
  async subscribeEvent(event: string, callback: (data: any) => void): Promise<string> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 包装回调以添加订阅ID
    const wrappedCallback = (data: any) => {
      callback({ ...data, subscriptionId })
    }

    this.eventEmitter.on(event, wrappedCallback)

    // 存储回调引用以便取消订阅
    this.subscriptions.set(subscriptionId, { event, callback: wrappedCallback })

    return subscriptionId
  }

  /**
   * 取消订阅事件
   */
  async unsubscribeEvent(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      console.warn(`订阅 ${subscriptionId} 不存在`)
      return false
    }

    // 从事件发射器移除监听器
    this.eventEmitter.off(subscription.event, subscription.callback)

    // 从存储中移除订阅
    this.subscriptions.delete(subscriptionId)

    return true
  }

  /**
   * 发射事件
   */
  async emitEvent(event: string, data?: any): Promise<boolean> {
    this.eventEmitter.emit(event, {
      type: event,
      data,
      timestamp: Date.now(),
      source: 'plugin-system'
    })
    return true
  }

  /**
   * 获取事件列表
   */
  async getEventList(): Promise<string[]> {
    // 获取所有已注册的事件名称（从事件发射器）
    const eventNames = this.eventEmitter.eventNames()

    // 添加系统事件和插件事件常量（确保包含）
    const standardEvents = [
      SYSTEM_EVENTS.APP_READY,
      SYSTEM_EVENTS.APP_BEFORE_QUIT,
      SYSTEM_EVENTS.CREATE_ENTITY,
      SYSTEM_EVENTS.UPDATE_ENTITY,
      SYSTEM_EVENTS.DELETE_ENTITY,
      PLUGIN_EVENTS.PLUGIN_LOADED,
      PLUGIN_EVENTS.PLUGIN_ACTIVATED,
      PLUGIN_EVENTS.PLUGIN_DEACTIVATED,
      PLUGIN_EVENTS.PLUGIN_CONFIG_CHANGED,
      PLUGIN_EVENTS.PLUGIN_INITIALIZED
    ]

    // 合并标准事件和实际注册的事件
    const eventSet = new Set<string>()

    // 添加标准事件
    standardEvents.forEach((event) => eventSet.add(event))

    // 添加实际注册的事件（转换为字符串）
    eventNames.forEach((event) => {
      if (typeof event === 'string') {
        eventSet.add(event)
      } else if (typeof event === 'symbol') {
        // 符号类型的事件通常为内部事件，不暴露给插件
        // 可以忽略或转换为字符串（可选）
        // eventSet.add(event.toString())
      }
    })

    return Array.from(eventSet)
  }

  // ==================== 插件权限管理 ====================

  /**
   * 获取插件权限
   */
  async getPermissions(id: string): Promise<PluginPermission[]> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      throw new Error(`插件 ${id} 不存在`)
    }

    return plugin.manifest.permissions || []
  }

  /**
   * 设置插件权限
   */
  async setPermissions(id: string, permissions: PluginPermission[]): Promise<boolean> {
    const plugin = this.plugins.get(id)
    if (!plugin) return false

    plugin.manifest.permissions = permissions
    return true
  }

  /**
   * 检查插件权限
   */
  async checkPermissions(id: string, requiredPermissions: PluginPermission[]): Promise<boolean> {
    const plugin = this.plugins.get(id)
    if (!plugin) return false

    const pluginPermissions = plugin.manifest.permissions || []

    // 检查是否拥有所有必需权限
    return requiredPermissions.every((permission) => pluginPermissions.includes(permission))
  }

  /**
   * 授予权限
   */
  async grantPermission(id: string, permission: PluginPermission): Promise<boolean> {
    const plugin = this.plugins.get(id)
    if (!plugin) return false

    if (!plugin.manifest.permissions) {
      plugin.manifest.permissions = []
    }

    if (!plugin.manifest.permissions.includes(permission)) {
      plugin.manifest.permissions.push(permission)
    }

    return true
  }

  /**
   * 撤销权限
   */
  async revokePermission(id: string, permission: PluginPermission): Promise<boolean> {
    const plugin = this.plugins.get(id)
    if (!plugin) return false

    if (!plugin.manifest.permissions) return false

    const index = plugin.manifest.permissions.indexOf(permission)
    if (index !== -1) {
      plugin.manifest.permissions.splice(index, 1)
      return true
    }

    return false
  }

  // ==================== 运行时配置管理 ====================

  /**
   * 获取插件运行时配置
   */
  async getPluginRuntimeConfig(id: string): Promise<PluginRuntimeConfig | null> {
    const plugin = this.plugins.get(id)
    if (!plugin) return null

    if (!plugin.runtimeConfig) {
      try {
        plugin.runtimeConfig = await this.pluginLoader.loadPluginConfig(plugin.installPath)
      } catch (error) {
        console.error(`加载插件 ${id} 配置失败:`, error)
        plugin.runtimeConfig = { ...DEFAULT_RUNTIME_CONFIG }
      }
    }

    return plugin.runtimeConfig
  }

  /**
   * 保存插件运行时配置
   */
  async savePluginRuntimeConfig(
    id: string,
    config: Partial<PluginRuntimeConfig>
  ): Promise<boolean> {
    const plugin = this.plugins.get(id)
    if (!plugin) return false

    const currentConfig = plugin.runtimeConfig || { ...DEFAULT_RUNTIME_CONFIG }
    const newConfig: PluginRuntimeConfig = {
      ...currentConfig,
      ...config,
      updatedAt: Date.now()
    }

    try {
      await this.pluginLoader.savePluginConfig(plugin.installPath, newConfig)
      plugin.runtimeConfig = newConfig

      // 如果启用了状态变更，更新内存中的enabled状态
      if (config.enabled !== undefined) {
        plugin.enabled = config.enabled
      }

      // 触发配置变更事件
      this.eventEmitter.emit(PLUGIN_EVENTS.PLUGIN_CONFIG_CHANGED, {
        pluginId: id,
        config: newConfig
      })

      return true
    } catch (error) {
      console.error(`保存插件 ${id} 配置失败:`, error)
      return false
    }
  }

  /**
   * 获取插件授予的权限
   */
  async getGrantedPermissions(id: string): Promise<PluginPermission[]> {
    const config = await this.getPluginRuntimeConfig(id)
    return config?.grantedPermissions || []
  }

  /**
   * 设置插件授予的权限
   */
  async setGrantedPermissions(id: string, permissions: PluginPermission[]): Promise<boolean> {
    return this.savePluginRuntimeConfig(id, { grantedPermissions: permissions })
  }

  /**
   * 检查插件是否拥有特定权限（基于授予的权限）
   */
  async checkGrantedPermission(id: string, permission: PluginPermission): Promise<boolean> {
    const granted = await this.getGrantedPermissions(id)
    return granted.includes(permission)
  }

  /**
   * 获取需要用户授权的权限列表（清单声明的权限 - 已授予的权限）
   */
  async getPendingPermissions(id: string): Promise<PluginPermission[]> {
    const plugin = this.plugins.get(id)
    if (!plugin) return []

    const manifestPermissions = plugin.manifest.permissions || []
    const grantedPermissions = await this.getGrantedPermissions(id)

    return manifestPermissions.filter((p) => !grantedPermissions.includes(p))
  }

  // ==================== 批量操作 ====================

  /**
   * 批量启用插件
   */
  async batchEnable(ids: string[]): Promise<PluginOperationResult[]> {
    const results: PluginOperationResult[] = []

    for (const id of ids) {
      try {
        const success = await this.enablePlugin(id)
        results.push({
          success,
          pluginId: id,
          message: success ? '启用成功' : '启用失败'
        })
      } catch (error) {
        results.push({
          success: false,
          pluginId: id,
          message: `启用失败: ${(error as Error).message}`,
          error: (error as Error).message
        })
      }
    }

    return results
  }

  /**
   * 批量禁用插件
   */
  async batchDisable(ids: string[]): Promise<PluginOperationResult[]> {
    const results: PluginOperationResult[] = []

    for (const id of ids) {
      try {
        const success = await this.disablePlugin(id)
        results.push({
          success,
          pluginId: id,
          message: success ? '禁用成功' : '禁用失败'
        })
      } catch (error) {
        results.push({
          success: false,
          pluginId: id,
          message: `禁用失败: ${(error as Error).message}`,
          error: (error as Error).message
        })
      }
    }

    return results
  }

  /**
   * 批量卸载插件
   */
  async batchUninstall(ids: string[]): Promise<PluginOperationResult[]> {
    const results: PluginOperationResult[] = []

    for (const id of ids) {
      try {
        const success = await this.uninstallPlugin(id)
        results.push({
          success,
          pluginId: id,
          message: success ? '卸载成功' : '卸载失败'
        })
      } catch (error) {
        results.push({
          success: false,
          pluginId: id,
          message: `卸载失败: ${(error as Error).message}`,
          error: (error as Error).message
        })
      }
    }

    return results
  }
}
