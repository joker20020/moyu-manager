import { ref, computed, type DeepReadonly, toRaw } from 'vue'
import type { AppConfigV2, ConfigCategory } from '@shared/types/config'

/**
 * Configuration composable for type-safe access to structured application configuration.
 * Provides reactive config state and methods to update configuration by category.
 */
const config = ref<AppConfigV2 | null>(null)
const isLoading = ref(true)
const error = ref<Error | null>(null)

export function useConfig() {
  async function loadConfig(): Promise<void> {
    try {
      isLoading.value = true
      error.value = null
      const fullConfig = await window.api.config.get('')
      config.value = fullConfig as AppConfigV2
      console.log('Loaded configuration:', fullConfig)
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Failed to load configuration:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function saveConfig(): Promise<void> {
    if (!config.value) return
    try {
      // 同步recentFiles
      const recentFiles = await window.api.config.get<Array<string>>('recentFiles', [])
      config.value.recentFiles = recentFiles
      const configRaw = toRaw(config.value)
      for (const key in configRaw) {
        configRaw[key] = toRaw(configRaw[key])
        if (key === 'plugins') {
          configRaw[key]['permissions'] = toRaw(configRaw[key]['permissions'])
        }
        if (key === 'shortcuts') {
          for (let i = 0; i < configRaw[key].length; i++) {
            configRaw[key][i] = toRaw(configRaw[key][i])
          }
        }
      }
      console.log('Saving configuration:', configRaw)
      await window.api.config.set('', configRaw)
    } catch (err) {
      console.error('Failed to save configuration:', err)
      throw err
    }
  }

  function getCategoryConfig<T extends ConfigCategory>(
    category: T
  ): DeepReadonly<AppConfigV2[T]> | null {
    if (!config.value) return null
    return config.value[category] as DeepReadonly<AppConfigV2[T]>
  }

  async function updateCategoryConfig<T extends ConfigCategory>(
    category: T,
    updates: Partial<AppConfigV2[T]>
  ): Promise<void> {
    if (!config.value) return

    const current = config.value[category]
    if (!current) return

    if (category === 'shortcuts') {
      config.value[category] = updates as AppConfigV2[T]
    } else {
      config.value = {
        ...config.value,
        [category]: { ...current, ...updates }
      }
    }
    await saveConfig()
  }

  function getConfigValue<T extends ConfigCategory, K extends keyof AppConfigV2[T]>(
    category: T,
    field: K
  ): DeepReadonly<AppConfigV2[T][K]> | null {
    const categoryConfig = getCategoryConfig(category)
    if (!categoryConfig) return null
    return (categoryConfig as any)[field] as DeepReadonly<AppConfigV2[T][K]>
  }

  async function setConfigValue<T extends ConfigCategory, K extends keyof AppConfigV2[T]>(
    category: T,
    field: K,
    value: AppConfigV2[T][K]
  ): Promise<void> {
    const update = { [field]: value } as any
    await updateCategoryConfig(category, update as Partial<AppConfigV2[T]>)
  }

  async function resetConfig(category?: ConfigCategory): Promise<void> {
    try {
      await window.api.config.reset(category)
      await loadConfig()
    } catch (err) {
      console.error('Failed to reset configuration:', err)
      throw err
    }
  }

  async function importConfig(jsonData: string): Promise<void> {
    try {
      await window.api.config.importConfig(jsonData)
      await loadConfig()
    } catch (err) {
      console.error('Failed to import configuration:', err)
      throw err
    }
  }

  async function exportConfig(): Promise<string> {
    try {
      return await window.api.config.exportConfig()
    } catch (err) {
      console.error('Failed to export configuration:', err)
      throw err
    }
  }

  loadConfig()

  return {
    config: computed(() => config.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),

    loadConfig,
    saveConfig,
    getCategoryConfig,
    updateCategoryConfig,
    getConfigValue,
    setConfigValue,
    resetConfig,
    importConfig,
    exportConfig,

    general: computed(() => getCategoryConfig('general')),
    appearance: computed(() => getCategoryConfig('appearance')),
    editor: computed(() => getCategoryConfig('editor')),
    data: computed(() => getCategoryConfig('data')),
    plugins: computed(() => getCategoryConfig('plugins')),
    advanced: computed(() => getCategoryConfig('advanced')),
    shortcuts: computed(() => getCategoryConfig('shortcuts'))
  }
}

export type UseConfigReturn = ReturnType<typeof useConfig>
