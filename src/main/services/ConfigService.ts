import { app } from 'electron'
import { Conf } from 'electron-conf/main'
import * as fs from 'fs'
import * as path from 'path'
import type {
  DeprecatedAppConfigV1,
  AppConfigV2,
  ShortcutConfig,
  ConfigValidationResult,
  ConfigCategory
} from '../../shared/types/config'
import {
  getDefaultAppConfigV2,
  migrateV1ToV2,
  validateAppConfigV2
} from '../../shared/types/config'
import { SystemService } from './SystemService'

export class ConfigService {
  private store: Conf<AppConfigV2>
  private configPath: string

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json')

    const configExists = fs.existsSync(this.configPath)

    let shouldCreateWithDefaults = true
    let migratedConfig: AppConfigV2 | null = null

    if (configExists) {
      try {
        const configContent = fs.readFileSync(this.configPath, 'utf8')
        const parsedConfig = JSON.parse(configContent)

        // Check if this is a V1 config that needs migration
        const hasV1Structure =
          parsedConfig.theme !== undefined &&
          parsedConfig.language !== undefined &&
          parsedConfig.autoSave !== undefined

        const hasV2Structure =
          parsedConfig.general !== undefined && parsedConfig.appearance !== undefined

        if (hasV1Structure && !hasV2Structure) {
          const v1Config: DeprecatedAppConfigV1 = {
            theme: parsedConfig.theme || 'dark',
            language: parsedConfig.language || 'zh-CN',
            autoSave: parsedConfig.autoSave !== undefined ? parsedConfig.autoSave : true,
            autoSaveInterval: parsedConfig.autoSaveInterval || 30000,
            recentFiles: Array.isArray(parsedConfig.recentFiles) ? parsedConfig.recentFiles : [],
            plugins: parsedConfig.plugins || {}
          }

          const uiSettings = parsedConfig.uiSettings

          migratedConfig = migrateV1ToV2(v1Config, uiSettings)

          // Write migrated config back to file so electron-conf loads it
          fs.writeFileSync(this.configPath, JSON.stringify(migratedConfig, null, 2))

          // We'll create Conf without defaults since file already has full config
          shouldCreateWithDefaults = false
        }
      } catch (error) {
        // 配置读取或迁移错误已静默处理
        SystemService.logError(error, 'ConfigService.constructor')
      }
    }

    // Initialize electron-conf store
    // If we migrated config, don't use defaults (file already has full config)
    // Otherwise use defaults (for fresh install or already V2 config)
    const options: any = {
      name: 'config',
      cwd: app.getPath('userData')
    }

    if (shouldCreateWithDefaults) {
      options.defaults = getDefaultAppConfigV2()
    }

    this.store = new Conf<AppConfigV2>(options)
    this.configPath = path.join(app.getPath('userData'), 'config.json')

    this.ensureMetaData()
  }

  private ensureMetaData(): void {
    const meta = this.store.get('meta')
    if (!meta || typeof meta !== 'object') {
      this.store.set('meta', {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        configPath: this.configPath
      })
    } else {
      if (!meta.configPath) {
        this.store.set('meta.configPath', this.configPath)
      }
      this.store.set('meta.updatedAt', Date.now())
    }
  }

  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    const mappedKey = this.mapBackwardCompatibilityKey(key)

    if (mappedKey === '') {
      return this.getConfig() as T
    }

    const value = this.store.get(mappedKey as any)

    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue
      }

      const defaultConfig = getDefaultAppConfigV2()
      const fallbackValue = this.getNestedValue(defaultConfig, mappedKey)
      return fallbackValue !== undefined ? fallbackValue : (undefined as any)
    }

    return value as T
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    const mappedKey = this.mapBackwardCompatibilityKey(key)

    if (mappedKey === '') {
      if (value && typeof value === 'object') {
        const currentConfig = this.getConfig()
        const mergedConfig = { ...currentConfig, ...value }
        mergedConfig.version = '2.0'
        mergedConfig.meta = currentConfig.meta || {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          configPath: this.configPath
        }
        this.store.store = mergedConfig
      }
    } else {
      this.store.set(mappedKey as any, value)
    }

    // Synchronize autoSaveInterval between top-level (milliseconds) and general.autoSaveInterval (minutes)
    if (key === 'autoSaveInterval' || mappedKey === 'autoSaveInterval') {
      const milliseconds = Number(value)
      if (!isNaN(milliseconds)) {
        const minutes = Math.floor(milliseconds / 60000)
        this.store.set('general.autoSaveInterval', minutes)
      }
    } else if (key === 'general.autoSaveInterval' || mappedKey === 'general.autoSaveInterval') {
      const minutes = Number(value)
      if (!isNaN(minutes)) {
        const milliseconds = minutes * 60000
        this.store.set('autoSaveInterval', milliseconds)
      }
    }

    this.store.set('meta.updatedAt', Date.now())
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      const defaultConfig = getDefaultAppConfigV2()
      const defaultValue = this.getNestedValue(defaultConfig, key)
      if (defaultValue !== undefined) {
        await this.set(key, defaultValue)
      }
    } else {
      this.store.store = getDefaultAppConfigV2()
      this.ensureMetaData()
    }
  }

  async getTheme(): Promise<string> {
    return this.store.get('appearance.theme')
  }

  async setTheme(theme: string): Promise<void> {
    this.store.set('appearance.theme', theme)
    this.store.set('theme', theme)
    this.store.set('meta.updatedAt', Date.now())
  }

  async exportConfig(): Promise<string> {
    return JSON.stringify(this.store.store, null, 2)
  }

  async importConfig(data: string): Promise<void> {
    try {
      const importedConfig = JSON.parse(data)

      const validation = validateAppConfigV2(importedConfig)
      if (!validation.valid) {
        throw new Error(
          `Invalid configuration: ${validation.errors.map((e) => e.message).join(', ')}`
        )
      }

      const configToImport = validation.cleanedConfig || importedConfig

      this.store.store = configToImport

      this.ensureMetaData()
    } catch (error) {
      SystemService.logError(error, 'ConfigService.importConfig')
      throw new Error(`Invalid config data: ${error}`)
    }
  }

  getConfig(): AppConfigV2 {
    return this.store.store
  }

  validateConfig(): ConfigValidationResult {
    return validateAppConfigV2(this.store.store)
  }

  getCategoryConfig<T extends ConfigCategory>(category: T): AppConfigV2[T] {
    return this.store.get(category as any)
  }

  updateCategoryConfig<T extends ConfigCategory>(
    category: T,
    updates: Partial<AppConfigV2[T]>
  ): void {
    const current = this.getCategoryConfig(category)
    if (Array.isArray(current) && Array.isArray(updates)) {
      this.store.set(category as any, updates)
    } else if (
      typeof current === 'object' &&
      current !== null &&
      typeof updates === 'object' &&
      updates !== null
    ) {
      this.store.set(category as any, { ...current, ...updates })
    } else {
      this.store.set(category as any, updates)
    }
    this.store.set('meta.updatedAt', Date.now())
  }

  getShortcutConfig(command: string): ShortcutConfig | undefined {
    const shortcuts = this.store.get('shortcuts') as ShortcutConfig[]
    return shortcuts.find((s) => s.command === command)
  }

  updateShortcutConfig(command: string, updates: Partial<ShortcutConfig>): void {
    const shortcuts = this.store.get('shortcuts') as ShortcutConfig[]
    const index = shortcuts.findIndex((s) => s.command === command)
    if (index >= 0) {
      shortcuts[index] = { ...shortcuts[index], ...updates }
      this.store.set('shortcuts', shortcuts)
      this.store.set('meta.updatedAt', Date.now())
    }
  }

  getConfigValue<T extends ConfigCategory, K extends keyof AppConfigV2[T]>(
    category: T,
    field: K
  ): AppConfigV2[T][K] {
    const categoryConfig = this.getCategoryConfig(category)
    return categoryConfig[field]
  }

  setConfigValue<T extends ConfigCategory, K extends keyof AppConfigV2[T]>(
    category: T,
    field: K,
    value: AppConfigV2[T][K]
  ): void {
    this.updateCategoryConfig(category, { [field]: value } as unknown as Partial<AppConfigV2[T]>)
  }

  private mapBackwardCompatibilityKey(key: string): string {
    const mapping: Record<string, string> = {
      theme: 'appearance.theme',
      language: 'general.language',
      autoSave: 'general.autoSave',
      autoSaveInterval: 'autoSaveInterval',
      recentFiles: 'recentFiles',
      plugins: 'pluginsLegacy',
      uiSettings: ''
    }

    if (mapping[key] !== undefined) {
      return mapping[key]
    }

    if (key.startsWith('uiSettings.')) {
      const subKey = key.substring('uiSettings.'.length)

      const uiMapping: Record<string, string> = {
        'editor.fontSize': 'appearance.fontSize',
        'editor.fontFamily': 'appearance.editorFont',
        'editor.indentSize': 'editor.indentSize',
        'editor.useSpaces': 'editor.useSpaces',
        'editor.lineNumbers': 'editor.lineNumbers',
        'editor.wordWrap': 'editor.wordWrap',
        'appearance.accentColor': 'appearance.accentColor',
        'appearance.density': 'appearance.density'
      }

      if (uiMapping[subKey]) {
        return uiMapping[subKey]
      }

      return subKey
    }

    if (key.startsWith('plugins.')) {
      return 'pluginsLegacy.' + key.substring('plugins.'.length)
    }

    return key
  }

  private getNestedValue(obj: any, path: string): any {
    if (!path) return obj

    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined
      }
      current = current[part]
    }

    return current
  }
}

export const configService = new ConfigService()
