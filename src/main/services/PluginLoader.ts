import * as fs from 'fs/promises'
import * as path from 'path'
import {
  PluginManifest,
  PluginDependency,
  PluginRuntimeConfig,
  DEFAULT_PLUGIN_DIRS,
  DEFAULT_RUNTIME_CONFIG,
  PLUGIN_MANIFEST_FILE,
  PLUGIN_MAIN_FILE,
  PLUGIN_FILE_EXTENSIONS
} from '../../shared/types/plugins'
import { PluginSandbox } from './PluginSandbox'
import { SystemService } from './SystemService'

/**
 * 插件加载器错误类型
 */
export class PluginLoaderError extends Error {
  constructor(
    message: string,
    public readonly pluginId?: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'PluginLoaderError'
  }
}

/**
 * 插件清单验证错误
 */
export class PluginManifestValidationError extends PluginLoaderError {
  constructor(message: string, pluginId?: string, cause?: Error) {
    super(`插件清单验证失败: ${message}`, pluginId, cause)
    this.name = 'PluginManifestValidationError'
  }
}

/**
 * 插件依赖解析错误
 */
export class PluginDependencyError extends PluginLoaderError {
  constructor(message: string, pluginId?: string, cause?: Error) {
    super(`插件依赖解析失败: ${message}`, pluginId, cause)
    this.name = 'PluginDependencyError'
  }
}

/**
 * 插件加载器 - 负责扫描、解析和加载插件文件
 */
export class PluginLoader {
  // 插件目录配置
  private pluginDirs = {
    system: DEFAULT_PLUGIN_DIRS.SYSTEM,
    user: DEFAULT_PLUGIN_DIRS.USER,
    dev: DEFAULT_PLUGIN_DIRS.DEV
  }

  // 已加载的插件清单缓存
  private manifestCache: Map<string, PluginManifest> = new Map()

  // 插件沙箱（可选）
  private sandbox?: PluginSandbox

  // 是否启用沙箱模式
  private sandboxEnabled: boolean = false

  /**
   * 设置插件目录
   */
  setPluginDirs(dirs: { system?: string; user?: string; dev?: string }): void {
    if (dirs.system) this.pluginDirs.system = dirs.system
    if (dirs.user) this.pluginDirs.user = dirs.user
    if (dirs.dev) this.pluginDirs.dev = dirs.dev
  }

  /**
   * 获取插件目录列表
   */
  getPluginDirs(): string[] {
    return Object.values(this.pluginDirs)
  }

  /**
   * 启用沙箱模式
   */
  enableSandbox(): void {
    this.sandboxEnabled = true
    if (!this.sandbox) {
      this.sandbox = new PluginSandbox()
    }
  }

  /**
   * 禁用沙箱模式
   */
  disableSandbox(): void {
    this.sandboxEnabled = false
  }

  /**
   * 获取沙箱实例
   */
  getSandbox(): PluginSandbox | undefined {
    return this.sandbox
  }

  /**
   * 扫描所有插件目录，查找插件清单
   */
  async scanForPlugins(): Promise<Array<{ manifest: PluginManifest; directory: string }>> {
    const plugins: Array<{ manifest: PluginManifest; directory: string }> = []

    // 按优先级扫描目录（system -> user -> dev）
    const dirs = [
      { path: this.pluginDirs.system, type: 'system' as const },
      { path: this.pluginDirs.user, type: 'user' as const },
      { path: this.pluginDirs.dev, type: 'dev' as const }
    ]

    for (const { path: dirPath, type } of dirs) {
      try {
        const dirPlugins = await this.scanDirectory(dirPath, type)
        plugins.push(...dirPlugins)
      } catch (error) {
        // 如果目录不存在，跳过（对于开发目录和用户目录是正常的）
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`扫描插件目录 ${dirPath} 时出错:`, error)
          await SystemService.logWarn(
            `扫描插件目录 ${dirPath} 时出错: ${error instanceof Error ? error.message : String(error)}`,
            'PluginLoader.scanForPlugins'
          )
        }
      }
    }

    return plugins
  }

  /**
   * 扫描单个目录中的插件
   */
  private async scanDirectory(
    dirPath: string,
    _type: 'system' | 'user' | 'dev'
  ): Promise<Array<{ manifest: PluginManifest; directory: string }>> {
    const plugins: Array<{ manifest: PluginManifest; directory: string }> = []

    try {
      // 检查目录是否存在
      await fs.access(dirPath)

      // 读取目录内容
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      // 遍历目录项
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginDir = path.join(dirPath, entry.name)

          try {
            // 检查是否存在插件清单文件
            const manifestPath = path.join(pluginDir, PLUGIN_MANIFEST_FILE)
            await fs.access(manifestPath)

            // 解析插件清单
            const manifest = await this.parseManifest(manifestPath, entry.name)

            // 验证插件清单
            this.validateManifest(manifest, pluginDir)

            plugins.push({
              manifest,
              directory: pluginDir
            })

            // 缓存清单
            this.manifestCache.set(manifest.id, manifest)
          } catch (error) {
            // 如果清单文件不存在或解析失败，跳过该目录
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              console.warn(`解析插件目录 ${pluginDir} 时出错:`, error)
              await SystemService.logWarn(
                `解析插件目录 ${pluginDir} 时出错: ${error instanceof Error ? error.message : String(error)}`,
                'PluginLoader.scanDirectory'
              )
            }
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`扫描目录 ${dirPath} 时出错:`, error)
        await SystemService.logWarn(`扫描目录 ${dirPath} 时出错: ${error instanceof Error ? error.message : String(error)}`, 'PluginLoader.scanDirectory')
      }
      return []
    }

    return plugins
  }

  /**
   * 解析插件清单文件
   */
  async parseManifest(manifestPath: string, expectedPluginId?: string): Promise<PluginManifest> {
    try {
      const content = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(content) as PluginManifest

      // 基本验证
      if (!manifest.id || typeof manifest.id !== 'string') {
        throw new PluginManifestValidationError('插件ID缺失或无效', expectedPluginId)
      }

      if (!manifest.name || typeof manifest.name !== 'string') {
        throw new PluginManifestValidationError('插件名称缺失或无效', manifest.id)
      }

      if (!manifest.version || typeof manifest.version !== 'string') {
        throw new PluginManifestValidationError('插件版本缺失或无效', manifest.id)
      }

      if (!manifest.description || typeof manifest.description !== 'string') {
        throw new PluginManifestValidationError('插件描述缺失或无效', manifest.id)
      }

      if (!manifest.author || typeof manifest.author !== 'string') {
        throw new PluginManifestValidationError('插件作者缺失或无效', manifest.id)
      }

      if (!manifest.compatibility || typeof manifest.compatibility !== 'string') {
        throw new PluginManifestValidationError('插件兼容性声明缺失或无效', manifest.id)
      }

      if (!manifest.category || !['system', 'user'].includes(manifest.category)) {
        throw new PluginManifestValidationError('插件分类无效', manifest.id)
      }

      if (!manifest.license || typeof manifest.license !== 'string') {
        throw new PluginManifestValidationError('插件许可证缺失或无效', manifest.id)
      }

      // 如果提供了expectedPluginId，检查是否匹配目录名
      if (expectedPluginId && manifest.id !== expectedPluginId) {
        console.warn(`插件ID "${manifest.id}" 与目录名 "${expectedPluginId}" 不匹配`)
      }

      return manifest
    } catch (error) {
      if (error instanceof PluginManifestValidationError) {
        throw error
      }
      throw new PluginManifestValidationError(
        `解析清单文件失败: ${(error as Error).message}`,
        expectedPluginId,
        error as Error
      )
    }
  }

  /**
   * 验证插件清单的完整性和有效性
   */
  validateManifest(manifest: PluginManifest, pluginDir: string): void {
    // 验证插件ID格式（只允许小写字母、数字、连字符）
    const idRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!idRegex.test(manifest.id)) {
      throw new PluginManifestValidationError(
        `插件ID "${manifest.id}" 格式无效，只能包含小写字母、数字和连字符`,
        manifest.id
      )
    }

    // 验证版本格式（基本semver验证）
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/
    if (!versionRegex.test(manifest.version)) {
      throw new PluginManifestValidationError(
        `插件版本 "${manifest.version}" 格式无效，应遵循语义化版本规范`,
        manifest.id
      )
    }

    // 验证主入口文件是否存在（如果指定了）
    if (manifest.main) {
      void path.join(pluginDir, manifest.main)
      // 注意：这里不实际检查文件，因为插件可能还未安装
      // 实际加载时会检查
    }

    // 验证图标文件是否存在（如果指定了）
    if (manifest.icon) {
      void path.join(pluginDir, manifest.icon)
      // 同样，实际加载时检查
    }

    // 验证依赖格式
    if (manifest.dependencies) {
      this.validateDependencies(manifest.dependencies, manifest.id)
    }

    if (manifest.optionalDependencies) {
      this.validateDependencies(manifest.optionalDependencies, manifest.id)
    }

    // 验证权限格式
    if (manifest.permissions) {
      if (!Array.isArray(manifest.permissions)) {
        throw new PluginManifestValidationError('权限配置必须是数组', manifest.id)
      }

      for (const permission of manifest.permissions) {
        if (typeof permission !== 'string') {
          throw new PluginManifestValidationError('权限必须是字符串', manifest.id)
        }
      }
    }

    // 验证命令格式
    if (manifest.commands) {
      if (!Array.isArray(manifest.commands)) {
        throw new PluginManifestValidationError('命令配置必须是数组', manifest.id)
      }

      for (const command of manifest.commands) {
        if (!command.id || typeof command.id !== 'string') {
          throw new PluginManifestValidationError('命令ID缺失或无效', manifest.id)
        }

        if (!command.name || typeof command.name !== 'string') {
          throw new PluginManifestValidationError(
            `命令 "${command.id}" 名称缺失或无效`,
            manifest.id
          )
        }
      }
    }

    // 验证视图格式
    if (manifest.views) {
      if (!Array.isArray(manifest.views)) {
        throw new PluginManifestValidationError('视图配置必须是数组', manifest.id)
      }

      for (const view of manifest.views) {
        if (!view.id || typeof view.id !== 'string') {
          throw new PluginManifestValidationError('视图ID缺失或无效', manifest.id)
        }

        if (!view.name || typeof view.name !== 'string') {
          throw new PluginManifestValidationError(`视图 "${view.id}" 名称缺失或无效`, manifest.id)
        }
      }
    }

    // 验证菜单格式
    if (manifest.menus) {
      if (!Array.isArray(manifest.menus)) {
        throw new PluginManifestValidationError('菜单配置必须是数组', manifest.id)
      }

      for (const menu of manifest.menus) {
        if (!menu.id || typeof menu.id !== 'string') {
          throw new PluginManifestValidationError('菜单ID缺失或无效', manifest.id)
        }

        if (!menu.name || typeof menu.name !== 'string') {
          throw new PluginManifestValidationError(`菜单 "${menu.id}" 名称缺失或无效`, manifest.id)
        }

        if (!menu.position || !['file', 'edit', 'view', 'plugin', 'help'].includes(menu.position)) {
          throw new PluginManifestValidationError(`菜单 "${menu.id}" 位置无效`, manifest.id)
        }
      }
    }
  }

  /**
   * 验证依赖配置
   */
  private validateDependencies(dependencies: PluginDependency[], pluginId: string): void {
    if (!Array.isArray(dependencies)) {
      throw new PluginManifestValidationError('依赖配置必须是数组', pluginId)
    }

    const seen = new Set<string>()

    for (const dep of dependencies) {
      if (!dep.pluginId || typeof dep.pluginId !== 'string') {
        throw new PluginManifestValidationError('依赖插件ID缺失或无效', pluginId)
      }

      if (!dep.version || typeof dep.version !== 'string') {
        throw new PluginManifestValidationError(`依赖 "${dep.pluginId}" 版本缺失或无效`, pluginId)
      }

      // 检查重复依赖
      if (seen.has(dep.pluginId)) {
        throw new PluginManifestValidationError(`重复的依赖声明: ${dep.pluginId}`, pluginId)
      }
      seen.add(dep.pluginId)
    }
  }

  /**
   * 检查插件依赖是否满足
   */
  async checkDependencies(
    manifest: PluginManifest,
    availablePlugins: Map<string, PluginManifest>
  ): Promise<{ missing: PluginDependency[]; incompatible: PluginDependency[] }> {
    const missing: PluginDependency[] = []
    const incompatible: PluginDependency[] = []

    // 检查必需依赖
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        const targetManifest = availablePlugins.get(dep.pluginId)

        if (!targetManifest) {
          missing.push(dep)
          continue
        }

        // TODO: 实现semver版本检查
        // 目前仅检查版本是否存在
        if (!this.checkVersionCompatibility(targetManifest.version, dep.version)) {
          incompatible.push(dep)
        }
      }
    }

    // 可选依赖不检查（但可以记录警告）

    return { missing, incompatible }
  }

  /**
   * 检查版本兼容性（简化版）
   */
  private checkVersionCompatibility(actualVersion: string, requiredVersion: string): boolean {
    // TODO: 实现完整的semver版本检查
    // 目前仅做简单字符串匹配
    if (requiredVersion === '*') return true

    // 处理 >= 前缀
    if (requiredVersion.startsWith('>=')) {
      const required = requiredVersion.slice(2)
      // 简化比较：假设版本格式规范
      return this.compareVersions(actualVersion, required) >= 0
    }

    // 处理 ~ 前缀（允许补丁版本更新）
    if (requiredVersion.startsWith('~')) {
      const required = requiredVersion.slice(1)
      const [major, minor] = required.split('.').map(Number)
      const [actualMajor, actualMinor] = actualVersion.split('.').map(Number)

      return actualMajor === major && actualMinor === minor
    }

    // 处理 ^ 前缀（允许次版本更新）
    if (requiredVersion.startsWith('^')) {
      const required = requiredVersion.slice(1)
      const [major] = required.split('.').map(Number)
      const [actualMajor] = actualVersion.split('.').map(Number)

      return actualMajor === major
    }

    // 精确匹配
    return actualVersion === requiredVersion
  }

  /**
   * 简化版本比较
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0
      const p2 = parts2[i] || 0

      if (p1 > p2) return 1
      if (p1 < p2) return -1
    }

    return 0
  }

  /**
   * 加载插件主模块
   * @param pluginDir 插件目录路径
   * @param manifest 插件清单
   * @param contextAPI 提供给插件的API上下文（沙箱模式下使用）
   */
  async loadPluginModule(
    pluginDir: string,
    manifest: PluginManifest,
    contextAPI?: Record<string, any>
  ): Promise<any> {
    try {
      // 确定入口文件
      let entryFile = manifest.main || PLUGIN_MAIN_FILE

      // 检查文件扩展名
      const hasExtension = PLUGIN_FILE_EXTENSIONS.some((ext) => entryFile.endsWith(ext))
      if (!hasExtension) {
        // 尝试添加.js扩展名
        entryFile = `${entryFile}.js`
      }

      const entryPath = path.join(pluginDir, entryFile)

      // 检查文件是否存在
      try {
        await fs.access(entryPath)
      } catch (error) {
        throw new PluginLoaderError(`插件入口文件不存在: ${entryFile}`, manifest.id, error as Error)
      }

      // 沙箱模式：使用PluginSandbox加载和隔离插件代码
      if (this.sandboxEnabled && this.sandbox) {
        try {
          // 准备基础上下文API（如果未提供，则使用空对象）
          const sandboxContext = contextAPI || {}

          // 加载插件模块到沙箱中
          const module = await this.sandbox.loadPluginModule(manifest.id, entryPath, sandboxContext)

          // 检查导出的结构
          if (typeof module !== 'object' && typeof module !== 'function') {
            throw new PluginLoaderError('插件模块必须导出对象或函数', manifest.id)
          }

          return module
        } catch (error) {
          if (error instanceof PluginLoaderError) {
            throw error
          }
          throw new PluginLoaderError(
            `沙箱模式下加载插件模块失败: ${(error as Error).message}`,
            manifest.id,
            error as Error
          )
        }
      }

      // 非沙箱模式：使用Node.js原生require加载（向后兼容）
      // 注意：在Electron主进程中，需要使用require而不是import
      // 但为了支持ES模块，可以使用动态import（Node.js 14+）

      try {
        // 清除require缓存（对于重载插件）
        delete require.cache[require.resolve(entryPath)]

        // 使用require加载CommonJS模块
        const module = require(entryPath)

        // 检查导出的结构
        if (typeof module !== 'object' && typeof module !== 'function') {
          throw new PluginLoaderError('插件模块必须导出对象或函数', manifest.id)
        }

        return module
      } catch (error) {
        throw new PluginLoaderError(
          `加载插件模块失败: ${(error as Error).message}`,
          manifest.id,
          error as Error
        )
      }
    } catch (error) {
      if (error instanceof PluginLoaderError) {
        throw error
      }
      throw new PluginLoaderError(
        `加载插件时发生错误: ${(error as Error).message}`,
        manifest.id,
        error as Error
      )
    }
  }

  /**
   * 检查插件冲突
   */
  checkConflicts(
    manifest: PluginManifest,
    installedPlugins: Map<string, PluginManifest>
  ): string[] {
    const conflicts: string[] = []

    // 检查插件ID是否已存在
    if (installedPlugins.has(manifest.id)) {
      conflicts.push(`插件ID "${manifest.id}" 已存在`)
    }

    // 检查声明的冲突插件
    if (manifest.conflicts) {
      for (const conflictId of manifest.conflicts) {
        if (installedPlugins.has(conflictId)) {
          conflicts.push(`与已安装插件 "${conflictId}" 冲突`)
        }
      }
    }

    // 检查其他插件是否声明与此插件冲突
    for (const [otherId, otherManifest] of Array.from(installedPlugins.entries())) {
      if (otherManifest.conflicts && otherManifest.conflicts.includes(manifest.id)) {
        conflicts.push(`已安装插件 "${otherId}" 声明与此插件冲突`)
      }
    }

    return conflicts
  }

  /**
   * 获取插件目录的绝对路径
   */
  resolvePluginDir(pluginId: string, type: 'system' | 'user' | 'dev' = 'user'): string {
    const baseDir = this.pluginDirs[type]
    return path.join(baseDir, pluginId)
  }

  /**
   * 安装插件文件
   */
  async installPluginFiles(
    sourceDir: string,
    targetPluginId: string,
    type: 'system' | 'user' | 'dev' = 'user'
  ): Promise<string> {
    const targetDir = this.resolvePluginDir(targetPluginId, type)

    try {
      // 确保目标目录存在
      await fs.mkdir(targetDir, { recursive: true })

      // 复制源目录内容到目标目录
      await this.copyDirectory(sourceDir, targetDir)

      return targetDir
    } catch (error) {
      throw new PluginLoaderError(
        `安装插件文件失败: ${(error as Error).message}`,
        targetPluginId,
        error as Error
      )
    }
  }

  /**
   * 复制目录（递归）
   */
  private async copyDirectory(source: string, target: string): Promise<void> {
    await fs.mkdir(target, { recursive: true })

    const entries = await fs.readdir(source, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name)
      const dstPath = path.join(target, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, dstPath)
      } else {
        await fs.copyFile(srcPath, dstPath)
      }
    }
  }

  /**
   * 卸载插件文件
   */
  async uninstallPluginFiles(
    pluginId: string,
    type: 'system' | 'user' | 'dev' = 'user'
  ): Promise<void> {
    const pluginDir = this.resolvePluginDir(pluginId, type)

    try {
      // 检查目录是否存在
      await fs.access(pluginDir)

      // 删除插件目录
      await fs.rm(pluginDir, { recursive: true, force: true })

      // 从缓存中移除
      this.manifestCache.delete(pluginId)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new PluginLoaderError(
          `卸载插件文件失败: ${(error as Error).message}`,
          pluginId,
          error as Error
        )
      }
      // 目录不存在，视为已卸载
    }
  }

  /**
   * 清理插件缓存
   */
  clearCache(): void {
    this.manifestCache.clear()
  }

  /**
   * 获取缓存的插件清单
   */
  getCachedManifest(pluginId: string): PluginManifest | undefined {
    return this.manifestCache.get(pluginId)
  }

  /**
   * 读取插件运行时配置
   * @param pluginDir 插件目录路径
   * @returns 运行时配置，如果不存在则返回默认配置
   */
  async loadPluginConfig(pluginDir: string): Promise<PluginRuntimeConfig> {
    const configPath = path.join(pluginDir, 'plugin-config.json')

    try {
      const content = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(content) as PluginRuntimeConfig

      // 验证配置结构
      if (!this.validateRuntimeConfig(config)) {
        console.warn(`插件配置格式无效: ${configPath}，使用默认配置`)
        return { ...DEFAULT_RUNTIME_CONFIG }
      }

      // 版本检查和迁移
      if (config.version !== '1.0') {
        return this.migrateRuntimeConfig(config)
      }

      return config
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 配置文件不存在，创建默认配置
        const defaultConfig = { ...DEFAULT_RUNTIME_CONFIG }
        await this.savePluginConfig(pluginDir, defaultConfig)
        return defaultConfig
      }
      console.warn(`读取插件配置失败: ${configPath}`, error)
      return { ...DEFAULT_RUNTIME_CONFIG }
    }
  }

  /**
   * 保存插件运行时配置
   * @param pluginDir 插件目录路径
   * @param config 运行时配置
   */
  async savePluginConfig(pluginDir: string, config: PluginRuntimeConfig): Promise<void> {
    const configPath = path.join(pluginDir, 'plugin-config.json')

    try {
      const configToSave = {
        ...config,
        updatedAt: Date.now()
      }
      await fs.writeFile(configPath, JSON.stringify(configToSave, null, 2), 'utf-8')
    } catch (error) {
      console.error(`保存插件配置失败: ${configPath}`, error)
      throw new PluginLoaderError(
        `保存插件配置失败: ${(error as Error).message}`,
        undefined,
        error as Error
      )
    }
  }

  /**
   * 验证运行时配置结构
   */
  private validateRuntimeConfig(config: any): boolean {
    return (
      config &&
      typeof config === 'object' &&
      typeof config.version === 'string' &&
      typeof config.enabled === 'boolean' &&
      Array.isArray(config.grantedPermissions)
    )
  }

  /**
   * 迁移运行时配置到新版本
   */
  private migrateRuntimeConfig(config: any): PluginRuntimeConfig {
    const version = config.version || '0.0'

    switch (version) {
      case '0.0':
        // 从旧格式迁移
        return {
          version: '1.0',
          enabled: config.enabled !== undefined ? config.enabled : true,
          grantedPermissions: config.permissions || config.grantedPermissions || [],
          customConfig: config.customConfig || config.settings || {},
          updatedAt: Date.now()
        }
      case '1.0':
        return config as PluginRuntimeConfig
      default:
        console.warn(`未知配置版本: ${version}，使用默认配置`)
        return { ...DEFAULT_RUNTIME_CONFIG }
    }
  }

  /**
   * 创建默认运行时配置
   */
  createDefaultConfig(): PluginRuntimeConfig {
    return { ...DEFAULT_RUNTIME_CONFIG }
  }
}
