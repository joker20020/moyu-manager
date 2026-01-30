import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ShortcutConfig } from '@shared/types/config'
import { ElMessage } from 'element-plus'

// 默认快捷键配置
const defaultShortcuts: ShortcutConfig[] = [
  { command: 'file.new', description: '新建文件', keybinding: 'Ctrl+N', default: 'Ctrl+N' },
  { command: 'file.open', description: '打开文件', keybinding: 'Ctrl+O', default: 'Ctrl+O' },
  { command: 'file.save', description: '保存文件', keybinding: 'Ctrl+S', default: 'Ctrl+S' },
  {
    command: 'file.saveAs',
    description: '另存为',
    keybinding: 'Ctrl+Shift+S',
    default: 'Ctrl+Shift+S'
  }
]

export const useShortcutsStore = defineStore('shortcuts', () => {
  // State
  const shortcuts = ref<ShortcutConfig[]>([...defaultShortcuts])
  const isLoaded = ref(false)

  // Getters
  const shortcutsMap = computed(() => {
    const map = new Map<string, ShortcutConfig>()
    shortcuts.value.forEach((s) => {
      if (s.keybinding) {
        map.set(normalizeKeybinding(s.keybinding), s)
      }
    })
    return map
  })

  // Actions
  function normalizeKeybinding(keybinding: string): string {
    if (!keybinding) return ''

    const parts = keybinding.split('+').map((p) => p.trim())
    const modifiers: string[] = []
    let mainKey = ''

    parts.forEach((part) => {
      const upperPart = part.toUpperCase()
      if (['CTRL', 'CONTROL'].includes(upperPart)) {
        modifiers.push('Ctrl')
      } else if (['SHIFT'].includes(upperPart)) {
        modifiers.push('Shift')
      } else if (['ALT'].includes(upperPart)) {
        modifiers.push('Alt')
      } else if (['META', 'COMMAND', 'CMD', 'WIN'].includes(upperPart)) {
        modifiers.push('Meta')
      } else {
        mainKey = part.toUpperCase()
      }
    })

    const orderedModifiers: string[] = []
    if (modifiers.includes('Ctrl')) orderedModifiers.push('Ctrl')
    if (modifiers.includes('Shift')) orderedModifiers.push('Shift')
    if (modifiers.includes('Alt')) orderedModifiers.push('Alt')
    if (modifiers.includes('Meta')) orderedModifiers.push('Meta')

    return mainKey ? [...orderedModifiers, mainKey].join('+') : orderedModifiers.join('+')
  }

  function setShortcuts(newShortcuts: ShortcutConfig[]) {
    shortcuts.value = [...newShortcuts]
  }

  function updateShortcut(index: number, keybinding: string) {
    if (shortcuts.value[index]) {
      shortcuts.value[index].keybinding = keybinding
    }
  }

  function resetShortcut(index: number) {
    if (shortcuts.value[index]) {
      shortcuts.value[index].keybinding = shortcuts.value[index].default
    }
  }

  function resetAllShortcuts() {
    shortcuts.value.forEach((shortcut) => {
      shortcut.keybinding = shortcut.default
    })
  }

  function findConflicts(keybinding: string, excludeIndex: number): string[] {
    const conflicts: string[] = []
    const normalizedNew = normalizeKeybinding(keybinding)

    shortcuts.value.forEach((shortcut, index) => {
      if (index !== excludeIndex) {
        const normalizedExisting = normalizeKeybinding(shortcut.keybinding)
        if (normalizedExisting === normalizedNew && normalizedExisting !== '') {
          conflicts.push(shortcut.description)
        }
      }
    })
    return conflicts
  }

  // 从键盘事件构建快捷键字符串
  function buildKeybinding(event: KeyboardEvent): string {
    const keys: string[] = []

    if (event.ctrlKey) keys.push('Ctrl')
    if (event.shiftKey) keys.push('Shift')
    if (event.altKey) keys.push('Alt')
    if (event.metaKey) keys.push('Meta')

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

  // 检查是否包含主键
  function hasMainKey(event: KeyboardEvent): boolean {
    const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock']
    return !modifierKeys.includes(event.key)
  }

  // 执行快捷键命令
  async function executeShortcutCommand(command: string): Promise<boolean> {
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

  return {
    shortcuts,
    isLoaded,
    shortcutsMap,
    normalizeKeybinding,
    setShortcuts,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    findConflicts,
    buildKeybinding,
    hasMainKey,
    executeShortcutCommand
  }
})
