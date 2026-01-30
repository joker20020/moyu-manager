import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { EntityType, EntityInstance } from '../../../shared/types/entities'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const currentView = ref('entities')
  const searchQuery = ref('')
  const selectedEntities = ref<string[]>([])

  const theme = ref<'dark' | 'light' | 'auto'>('dark')
  const systemTheme = ref<'dark' | 'light'>('light')
  const effectiveTheme = computed(() => {
    if (theme.value === 'auto') {
      return systemTheme.value
    }
    return theme.value
  })
  const isDark = computed(() => effectiveTheme.value === 'dark')

  const getSystemTheme = (): 'dark' | 'light' => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    return mediaQuery.matches ? 'dark' : 'light'
  }

  const setupSystemThemeListener = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      systemTheme.value = e.matches ? 'dark' : 'light'
      if (theme.value === 'auto') {
        applyTheme(systemTheme.value)
      }
    })
  }

  const applyTheme = (newTheme: 'dark' | 'light') => {
    const html = document.documentElement
    html.setAttribute('data-theme', newTheme)
    if (newTheme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  const setTheme = (newTheme: 'dark' | 'light' | 'auto') => {
    theme.value = newTheme
    const actualTheme = newTheme === 'auto' ? systemTheme.value : newTheme
    applyTheme(actualTheme)
  }

  const initTheme = async () => {
    try {
      systemTheme.value = getSystemTheme()
      setupSystemThemeListener()

      const savedTheme = (await window.api.config.getTheme()) as 'dark' | 'light' | 'auto'
      theme.value = savedTheme || 'dark'

      const actualTheme = theme.value === 'auto' ? systemTheme.value : theme.value
      applyTheme(actualTheme)
    } catch (error) {
      console.error('Failed to load theme:', error)
      applyTheme('dark')
    }
  }

  watch(theme, (newTheme) => {
    const actualTheme = newTheme === 'auto' ? systemTheme.value : newTheme
    applyTheme(actualTheme)
  })

  const entityTypes = ref<EntityType[]>([])
  const entities = ref<EntityInstance[]>([])
  const loading = ref({
    entities: false,
    types: false
  })

  const entityCount = computed(() => entities.value.length)
  const pluginCount = ref(0)
  const usedStorage = ref(0)
  const totalStorage = ref(100)
  const memoryUsage = ref(0)
  const systemStats = ref<any>(null)

  const loadSystemStats = async () => {
    try {
      const stats = await window.api.system.getStats()
      systemStats.value = stats

      usedStorage.value = stats.storage?.used || 0
      totalStorage.value = stats.storage?.total || 100
      memoryUsage.value = stats.memory?.used || 0
    } catch (error) {
      console.error('Failed to load system stats:', error)
    }
  }

  const storagePercentage = computed(() => {
    return Math.round((usedStorage.value / totalStorage.value) * 100)
  })

  const selectedCount = computed(() => selectedEntities.value.length)

  const mappedEntityTypes = computed(() => {
    return entityTypes.value.map((type) => {
      const count = entities.value.filter((e) => e._type === type.id).length
      return {
        id: type.id,
        name: type.name,
        description: type.description || '',
        fieldCount: type.fields.length + type.fixedFields.length,
        count
      }
    })
  })

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setCurrentView = (view: string) => {
    currentView.value = view
  }

  const setSearchQuery = (query: string) => {
    searchQuery.value = query
  }

  const selectEntity = (id: string) => {
    if (!selectedEntities.value.includes(id)) {
      selectedEntities.value.push(id)
    }
  }

  const deselectEntity = (id: string) => {
    const index = selectedEntities.value.indexOf(id)
    if (index > -1) {
      selectedEntities.value.splice(index, 1)
    }
  }

  const clearSelection = () => {
    selectedEntities.value = []
  }

  const updatePluginCount = (count: number) => {
    pluginCount.value = count
  }

  const updateMemoryUsage = (usage: number) => {
    memoryUsage.value = usage
  }

  const fetchEntities = async () => {
    loading.value.entities = true
    try {
      const data = await window.api.entities.getEntities()
      entities.value = data
    } catch (error) {
      console.error('Failed to fetch entities:', error)
    } finally {
      loading.value.entities = false
    }
  }

  const fetchEntityTypes = async () => {
    loading.value.types = true
    try {
      const types = await window.api.entities.getTypes()
      entityTypes.value = types
    } catch (error) {
      console.error('Failed to fetch entity types:', error)
    } finally {
      loading.value.types = false
    }
  }

  const refreshEntities = async () => {
    await Promise.all([fetchEntities(), fetchEntityTypes(), loadSystemStats()])
  }

  const fetchPlugins = async () => {
    try {
      const plugins = await window.api.plugins.getPlugins()
      pluginCount.value = plugins.length
    } catch (error) {
      console.error('Failed to fetch plugins:', error)
    }
  }

  return {
    sidebarCollapsed,
    currentView,
    searchQuery,
    selectedEntities,
    theme,
    entityTypes,
    entities,
    loading,
    entityCount,
    pluginCount,
    usedStorage,
    totalStorage,
    memoryUsage,
    storagePercentage,
    selectedCount,
    mappedEntityTypes,
    isDark,
    toggleSidebar,
    setCurrentView,
    setSearchQuery,
    selectEntity,
    deselectEntity,
    clearSelection,
    updatePluginCount,
    updateMemoryUsage,
    applyTheme,
    initTheme,
    fetchEntities,
    fetchEntityTypes,
    loadSystemStats,
    refreshEntities,
    fetchPlugins
  }
})
