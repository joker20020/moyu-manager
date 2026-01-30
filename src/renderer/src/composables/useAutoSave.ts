import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

const isAutoSaving = ref(false)
const lastSaveTime = ref<Date | null>(null)
const autoSaveTimer = ref<NodeJS.Timeout | null>(null)
const currentFilePath = ref<string | null>(null)
let selectingPath = false
export function useAutoSave() {
  const getAutoSaveConfig = async () => {
    try {
      const config = await window.api.config.get('general')
      return {
        enabled: config?.autoSave ?? false,
        interval: (config?.autoSaveInterval ?? 5) * 60 * 1000
      }
    } catch (error) {
      console.error('Failed to get auto save config:', error)
      return { enabled: false, interval: 5 * 60 * 1000 }
    }
  }

  const checkHasOpenedFile = async (): Promise<boolean> => {
    try {
      return await window.api.files.hasOpenedFile()
    } catch (error) {
      console.error('Failed to check opened file:', error)
      return false
    }
  }

  const getCurrentFilePath = async (): Promise<string | null> => {
    try {
      return await window.api.files.getCurrentFile()
    } catch (error) {
      console.error('Failed to get current file:', error)
      return null
    }
  }

  const performSave = async (filePath?: string): Promise<boolean> => {
    try {
      isAutoSaving.value = true
      const result = await window.api.files.save(filePath)
      if (result) {
        lastSaveTime.value = new Date()
      }
      return result
    } catch (error) {
      console.error('Auto save failed:', error)
      return false
    } finally {
      isAutoSaving.value = false
    }
  }

  const promptForSaveLocation = async (): Promise<string | null> => {
    try {
      return await window.api.files.saveAs()
    } catch (error) {
      console.error('Failed to prompt for save location:', error)
      ElMessage.error('选择保存路径失败')
      return null
    }
  }

  const disableAutoSave = async () => {
    try {
      await window.api.config.set('general.autoSave', false)
      stopAutoSave()
    } catch (error) {
      console.error('Failed to disable auto save:', error)
    }
  }

  const autoSave = async () => {
    console.log('Auto save triggered')
    const hasOpenedFile = await checkHasOpenedFile()

    if (!hasOpenedFile) {
      if (selectingPath) {
        return
      }
      ElMessage.warning('请先选择保存位置以启用自动保存')
      selectingPath = true
      const filePath = await promptForSaveLocation()
      selectingPath = false

      if (filePath) {
        const saved = await performSave(filePath)
        if (saved) {
          ElMessage.success('已保存并启用自动保存')
          currentFilePath.value = filePath
        } else {
          ElMessage.error('保存失败，请重试')
        }
      } else {
        await disableAutoSave()
        ElMessage.info('已取消自动保存，您可以手动保存文件')
      }
    } else {
      const saved = await performSave()
      if (!saved) {
        ElMessage.warning('自动保存失败，请检查文件权限')
      }
    }
  }

  const startAutoSave = (intervalMs: number) => {
    stopAutoSave()
    autoSave()
    autoSaveTimer.value = setInterval(() => {
      autoSave()
    }, intervalMs * 60)
  }

  const stopAutoSave = () => {
    if (autoSaveTimer.value) {
      clearInterval(autoSaveTimer.value)
      autoSaveTimer.value = null
    }
  }

  const initAutoSave = async () => {
    const config = await getAutoSaveConfig()
    if (config.enabled) {
      startAutoSave(config.interval)
    } else {
      stopAutoSave()
    }
  }

  const watchAutoSaveConfig = () => {
    const checkInterval = setInterval(async () => {
      const config = await getAutoSaveConfig()
      const isRunning = autoSaveTimer.value !== null

      if (config.enabled && !isRunning) {
        startAutoSave(config.interval)
      } else if (!config.enabled && isRunning) {
        stopAutoSave()
      }
    }, 5000)

    return () => clearInterval(checkInterval)
  }

  onMounted(() => {
    initAutoSave()
    const unwatch = watchAutoSaveConfig()

    onUnmounted(() => {
      stopAutoSave()
      unwatch()
    })
  })

  return {
    isAutoSaving,
    lastSaveTime,
    currentFilePath,
    initAutoSave,
    startAutoSave,
    stopAutoSave,
    performSave
  }
}
