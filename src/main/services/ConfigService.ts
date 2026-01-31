import { app } from 'electron'
import { Conf } from 'electron-conf/main'
import * as path from 'path'
import type {
  AppConfigV2,
  ShortcutConfig,
  ConfigValidationResult,
  ConfigCategory
} from '../../shared/types/config'
import { getDefaultAppConfigV2, validateAppConfigV2 } from '../../shared/types/config'
import { SystemService } from './SystemService'

export class ConfigService {
  private store: Conf<AppConfigV2>
  private configPath: string

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json')

    // Initialize electron-conf store with V2 defaults
    const options: any = {
      name: 'config',
      cwd: app.getPath('userData'),
      defaults: getDefaultAppConfigV2()
    }

    this.store = new Conf<AppConfigV2>(options)

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
    if (key === '') {
      return this.store.store as T
    }
    const value = this.store.get(key as any)

    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue
      }

      const defaultConfig = getDefaultAppConfigV2()
      const fallbackValue = this.getNestedValue(defaultConfig, key)
      return fallbackValue !== undefined ? fallbackValue : (undefined as any)
    }

    return value as T
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    const parts = key.split('.')
    if (key === '') {
      // Top-level key
      this.store.store = value as AppConfigV2
    } else {
      // Nested key - need to update the whole category object
      const category = parts[0] as ConfigCategory
      const field = parts.slice(1).join('.')
      const currentCategory = this.getCategoryConfig(category)

      if (
        currentCategory &&
        typeof currentCategory === 'object' &&
        !Array.isArray(currentCategory)
      ) {
        const updatedCategory = { ...currentCategory }
        this.setNestedValue(updatedCategory, field, value)
        this.store.set(category as any, updatedCategory)
      } else {
        this.store.set(key as any, value)
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

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (current[part] === undefined || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part]
    }

    current[parts[parts.length - 1]] = value
  }
}

export const configService = new ConfigService()
