import { ref, onMounted, onUnmounted } from 'vue'
import type { ShortcutConfig } from '@shared/types/config'
import { useConfig } from './useConfig'
import { ElMessage } from 'element-plus'

// 单例状态 - 所有组件共享同一个 shortcuts 引用
const shortcuts = ref<ShortcutConfig[]>([])
const isRecording = ref(false)
const recordingIndex = ref(-1)
let isLoaded = false

// 快捷键管理 Composable (单例模式)
export function useShortcuts() {
  const configApi = useConfig()

  // 加载快捷键配置
  const loadShortcuts = async () => {
    // 如果已经加载过，不再重复加载
    if (isLoaded) return

    try {
      await configApi.loadConfig()
      const config = configApi.config.value
      if (config?.shortcuts && Array.isArray(config.shortcuts)) {
        shortcuts.value = config.shortcuts
        isLoaded = true
      }
    } catch (error) {
      console.error('Failed to load shortcuts:', error)
    }
  }

  // 重新加载快捷键配置（强制刷新）
  const reloadShortcuts = async () => {
    try {
      await configApi.loadConfig()
      const config = configApi.config.value
      if (config?.shortcuts && Array.isArray(config.shortcuts)) {
        shortcuts.value = config.shortcuts
        isLoaded = true
      }
    } catch (error) {
      console.error('Failed to reload shortcuts:', error)
    }
  }

  // 保存快捷键配置
  const saveShortcuts = async () => {
    try {
      await configApi.updateCategoryConfig('shortcuts', shortcuts.value)
      // 保存成功后，重新加载以确保状态同步
      await reloadShortcuts()
      return true
    } catch (error) {
      console.error('Failed to save shortcuts:', error)
      return false
    }
  }

  // 获取快捷键显示名称
  const getShortcutDisplay = (keybinding: string): string => {
    if (!keybinding) return ''

    // 统一格式：将 Ctrl 放在前面，然后是 Shift、Alt、Meta，最后是主键
    const parts = keybinding.split('+')
    const modifiers: string[] = []
    let mainKey = ''

    parts.forEach((part) => {
      const upperPart = part.trim()
      if (['Ctrl', 'Control'].includes(upperPart)) {
        modifiers.push('Ctrl')
      } else if (['Shift'].includes(upperPart)) {
        modifiers.push('Shift')
      } else if (['Alt'].includes(upperPart)) {
        modifiers.push('Alt')
      } else if (['Meta', 'Command', 'Cmd', 'Win'].includes(upperPart)) {
        modifiers.push('Meta')
      } else {
        mainKey = upperPart
      }
    })

    // 按标准顺序排列修饰键
    const orderedModifiers: string[] = []
    if (modifiers.includes('Ctrl')) orderedModifiers.push('Ctrl')
    if (modifiers.includes('Shift')) orderedModifiers.push('Shift')
    if (modifiers.includes('Alt')) orderedModifiers.push('Alt')
    if (modifiers.includes('Meta')) orderedModifiers.push('Meta')

    return mainKey ? [...orderedModifiers, mainKey].join('+') : orderedModifiers.join('+')
  }

  // 检查键盘事件是否包含主键（非修饰键）
  const hasMainKey = (event: KeyboardEvent): boolean => {
    const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock']
    return !modifierKeys.includes(event.key)
  }

  // 从键盘事件构建快捷键字符串
  const buildKeybinding = (event: KeyboardEvent): string => {
    const keys: string[] = []

    // 添加修饰键（按标准顺序）
    if (event.ctrlKey) keys.push('Ctrl')
    if (event.shiftKey) keys.push('Shift')
    if (event.altKey) keys.push('Alt')
    if (event.metaKey) keys.push('Meta')

    // 添加主键
    let mainKey = ''
    const specialKeyMap: Record<string, string> = {
      Enter: 'Enter',
      Escape: 'Escape',
      Tab: 'Tab',
      Space: 'Space',
      Backspace: 'Backspace',
      Delete: 'Delete',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
      Insert: 'Insert',
      F1: 'F1',
      F2: 'F2',
      F3: 'F3',
      F4: 'F4',
      F5: 'F5',
      F6: 'F6',
      F7: 'F7',
      F8: 'F8',
      F9: 'F9',
      F10: 'F10',
      F11: 'F11',
      F12: 'F12'
    }

    if (specialKeyMap[event.key]) {
      mainKey = specialKeyMap[event.key]
    } else if (event.key.length === 1) {
      mainKey = event.key.toUpperCase()
    } else if (event.code.startsWith('Key')) {
      mainKey = event.code.replace('Key', '')
    } else if (event.code.startsWith('Digit')) {
      mainKey = event.code.replace('Digit', '')
    } else if (event.code.startsWith('Numpad')) {
      mainKey = 'Num' + event.code.replace('Numpad', '')
    }

    if (mainKey && !['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
      keys.push(mainKey)
    }

    return keys.join('+')
  }

  // 检测快捷键冲突
  const findConflicts = (keybinding: string, excludeIndex: number): string[] => {
    const conflicts: string[] = []
    const normalizedNew = getShortcutDisplay(keybinding)

    shortcuts.value.forEach((shortcut, index) => {
      if (index !== excludeIndex) {
        const normalizedExisting = getShortcutDisplay(shortcut.keybinding)
        if (normalizedExisting === normalizedNew) {
          conflicts.push(shortcut.description)
        }
      }
    })
    return conflicts
  }

  // 重置快捷键
  const resetShortcut = (index: number) => {
    if (shortcuts.value[index]) {
      shortcuts.value[index].keybinding = shortcuts.value[index].default
    }
  }

  // 重置所有快捷键
  const resetAllShortcuts = () => {
    shortcuts.value.forEach((shortcut) => {
      shortcut.keybinding = shortcut.default
    })
  }

  // 执行快捷键命令
  const executeShortcutCommand = async (command: string): Promise<boolean> => {
    try {
      switch (command) {
        case 'file.new':
          await window.api.files['new']()
          ElMessage.success('新建文件成功')
          return true
        case 'file.open':
          await window.api.files.open()
          ElMessage.success('打开文件成功')
          return true
        case 'file.save':
          await window.api.files.save()
          ElMessage.success('保存文件成功')
          return true
        case 'file.saveAs':
          await window.api.files.saveAs()
          ElMessage.success('另存为成功')
          return true
        default:
          return false
      }
    } catch (error: any) {
      if (error !== 'cancel' && error?.message !== 'cancel') {
        console.error(`Failed to execute command ${command}:`, error)
        ElMessage.error(`执行操作失败: ${error?.message || '未知错误'}`)
      }
      return false
    }
  }

  // 全局键盘事件处理
  const handleGlobalKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    const isInputElement =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable

    if (isInputElement && event.key !== 'Escape') {
      return
    }

    const keybinding = buildKeybinding(event)
    if (!keybinding) return

    const matchedShortcut = shortcuts.value.find((s) => {
      const normalizedStored = getShortcutDisplay(s.keybinding)
      const normalizedPressed = getShortcutDisplay(keybinding)
      return normalizedStored === normalizedPressed && s.keybinding
    })

    if (matchedShortcut) {
      event.preventDefault()
      executeShortcutCommand(matchedShortcut.command)
    }
  }

  // 启用全局快捷键监听
  const enableGlobalShortcuts = () => {
    document.addEventListener('keydown', handleGlobalKeyDown)
  }

  // 禁用全局快捷键监听
  const disableGlobalShortcuts = () => {
    document.removeEventListener('keydown', handleGlobalKeyDown)
  }

  // 组件挂载时加载配置
  onMounted(() => {
    loadShortcuts()
  })

  // 组件卸载时清理
  onUnmounted(() => {
    disableGlobalShortcuts()
  })

  return {
    shortcuts,
    isRecording,
    recordingIndex,
    loadShortcuts,
    reloadShortcuts,
    saveShortcuts,
    getShortcutDisplay,
    buildKeybinding,
    hasMainKey,
    findConflicts,
    resetShortcut,
    resetAllShortcuts,
    executeShortcutCommand,
    enableGlobalShortcuts,
    disableGlobalShortcuts
  }
}
