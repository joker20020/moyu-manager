// 配置管理系统类型定义
// 版本: 2.0.0 - 结构化配置

// ==================== 配置版本控制 ====================

/**
 * 配置版本标识符
 * - '2.0': 当前结构化配置（包含所有SettingsView.vue中的设置）
 */
export type ConfigVersion = '2.0'

// ==================== 配置类别定义 ====================

/**
 * 通用设置配置
 */
export interface GeneralConfig {
  /** 界面语言 */
  language: string
  /** 启动行为：restore-恢复上次会话, new-新建空白文件, ask-询问用户 */
  startupBehavior: 'restore' | 'new' | 'ask'
  /** 是否启用自动保存 */
  autoSave: boolean
  /** 自动保存间隔（分钟） */
  autoSaveInterval: number
  /** 是否自动检查更新 */
  autoCheckAppUpdates: boolean
}

/**
 * 外观设置配置
 */
export interface AppearanceConfig {
  /** 主题模式：dark-暗色, light-浅色, auto-跟随系统 */
  theme: 'dark' | 'light' | 'auto'
  /** 强调色（十六进制颜色值） */
  accentColor: string
  /** 基础字体大小 */
  fontSize: number
  /** 编辑器字体 */
  editorFont: string
  /** 界面密度：compact-紧凑, normal-正常, comfortable-宽松 */
  density: 'compact' | 'normal' | 'comfortable'
}

/**
 * 编辑器设置配置
 */
export interface EditorConfig {
  /** 是否启用自动完成 */
  autoComplete: boolean
  /** 是否启用代码折叠 */
  codeFolding: boolean
  /** 是否显示行号 */
  lineNumbers: boolean
  /** 缩进大小（空格数量） */
  indentSize: number
  /** 是否使用空格代替制表符进行缩进 */
  useSpaces: boolean
  /** 是否启用自动换行 */
  wordWrap: boolean
  /** 是否高亮当前行 */
  highlightCurrentLine: boolean
  /** 是否显示缩进参考线 */
  showIndentGuides: boolean
}

/**
 * 数据管理配置
 */
export interface DataConfig {
  /** 默认保存位置 */
  defaultSaveLocation: string
  /** 是否启用自动备份 */
  autoBackup: boolean
  /** 备份间隔：daily-每天, weekly-每周, monthly-每月 */
  backupInterval: 'daily' | 'weekly' | 'monthly'
  /** 保留的备份文件数量 */
  backupRetention: number
}

/**
 * 插件管理配置
 */
export interface PluginsConfig {
  /** 插件目录路径 */
  pluginDirectory: string
  /** 是否自动检查插件更新 */
  autoCheckUpdates: boolean
  /** 是否自动更新插件（需要开启自动检查更新） */
  autoUpdate: boolean
  /** 插件权限限制 */
  permissions: Array<'filesystem' | 'network' | 'system'>
}

/**
 * 高级设置配置
 */
export interface AdvancedConfig {
  /** 是否启用开发者模式 */
  developerMode: boolean
  /** 日志级别：error-错误, warn-警告, info-信息, debug-调试 */
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  /** 是否启用实验性功能 */
  experimentalFeatures: boolean
  /** 是否启用硬件加速 */
  hardwareAcceleration: boolean
  /** 是否启用性能监控 */
  performanceMonitoring: boolean
}

/**
 * 快捷键配置项
 */
export interface ShortcutConfig {
  /** 命令标识符 */
  command: string
  /** 命令描述 */
  description: string
  /** 快捷键绑定 */
  keybinding: string
  /** 默认快捷键 */
  default: string
}

// ==================== 强调色选项 ====================

/**
 * 强调色选项
 */
export interface AccentColorOption {
  /** 颜色名称 */
  name: string
  /** 颜色值（十六进制） */
  value: string
}

// ==================== 主配置结构 ====================

/**
 * 应用程序完整配置结构（版本2.0）
 */
export interface AppConfigV2 {
  /** 配置版本标识符 */
  version: ConfigVersion

  // 结构化配置类别
  general: GeneralConfig
  appearance: AppearanceConfig
  editor: EditorConfig
  data: DataConfig
  plugins: PluginsConfig
  advanced: AdvancedConfig
  shortcuts: ShortcutConfig[]

  recentFiles: string[]

  // 扩展字段（用于未来扩展）
  meta?: {
    /** 配置文件创建时间 */
    createdAt: number
    /** 最后修改时间 */
    updatedAt: number
    /** 配置文件路径 */
    configPath: string
  }
}

// ==================== 配置类型守卫和辅助函数 ====================

/**
 * 检查配置是否为版本2.0
 */
export function isAppConfigV2(config: any): config is AppConfigV2 {
  return (
    config &&
    config.version === '2.0' &&
    typeof config.general === 'object' &&
    typeof config.appearance === 'object' &&
    typeof config.editor === 'object' &&
    typeof config.data === 'object' &&
    typeof config.plugins === 'object' &&
    typeof config.advanced === 'object' &&
    Array.isArray(config.shortcuts)
  )
}

/**
 * 获取默认的AppConfigV2配置
 */
export function getDefaultAppConfigV2(): AppConfigV2 {
  return {
    version: '2.0',

    // 结构化配置
    general: {
      language: 'zh-CN',
      startupBehavior: 'restore',
      autoSave: true,
      autoSaveInterval: 1,
      autoCheckAppUpdates: true
    },

    appearance: {
      theme: 'dark',
      accentColor: '#8a6df7',
      fontSize: 14,
      editorFont: 'JetBrains Mono',
      density: 'normal'
    },

    editor: {
      autoComplete: true,
      codeFolding: true,
      lineNumbers: true,
      indentSize: 2,
      useSpaces: true,
      wordWrap: false,
      highlightCurrentLine: true,
      showIndentGuides: true
    },

    data: {
      defaultSaveLocation: '~/Documents/EntityManager',
      autoBackup: true,
      backupInterval: 'daily',
      backupRetention: 10
    },

    plugins: {
      pluginDirectory: '~/Documents/EntityManager/Plugins',
      autoCheckUpdates: true,
      autoUpdate: false,
      permissions: ['filesystem']
    },

    advanced: {
      developerMode: false,
      logLevel: 'info',
      experimentalFeatures: false,
      hardwareAcceleration: true,
      performanceMonitoring: false
    },

    shortcuts: [
      { command: 'file.new', description: '新建文件', keybinding: 'Ctrl+N', default: 'Ctrl+N' },
      { command: 'file.open', description: '打开文件', keybinding: 'Ctrl+O', default: 'Ctrl+O' },
      { command: 'file.save', description: '保存文件', keybinding: 'Ctrl+S', default: 'Ctrl+S' },
      {
        command: 'file.saveAs',
        description: '另存为',
        keybinding: 'Ctrl+Shift+S',
        default: 'Ctrl+Shift+S'
      }
    ],

    recentFiles: [],

    // 元数据
    meta: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configPath: ''
    }
  }
}

/**
 * 配置验证错误
 */
export interface ConfigValidationError {
  /** 错误路径 */
  path: string
  /** 错误消息 */
  message: string
  /** 期望的类型或值 */
  expected?: any
  /** 实际的值 */
  actual?: any
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  /** 是否有效 */
  valid: boolean
  /** 验证错误列表 */
  errors: ConfigValidationError[]
  /** 清理后的配置（移除无效字段） */
  cleanedConfig?: AppConfigV2
}

/**
 * 验证AppConfigV2配置
 */
export function validateAppConfigV2(config: any): ConfigValidationResult {
  const errors: ConfigValidationError[] = []

  // 基本结构检查
  if (!config || typeof config !== 'object') {
    errors.push({ path: '', message: '配置必须是一个对象' })
    return { valid: false, errors }
  }

  // 版本检查
  if (config.version !== '2.0') {
    errors.push({
      path: 'version',
      message: '配置版本必须是2.0',
      expected: '2.0',
      actual: config.version
    })
  }

  // 验证各个配置类别
  const categories: Array<keyof AppConfigV2> = [
    'general',
    'appearance',
    'editor',
    'data',
    'plugins',
    'advanced'
  ]

  categories.forEach((category) => {
    if (!config[category] || typeof config[category] !== 'object') {
      errors.push({
        path: category,
        message: `${category}配置必须是一个对象`
      })
    }
  })

  // 验证shortcuts数组
  if (!Array.isArray(config.shortcuts)) {
    errors.push({ path: 'shortcuts', message: 'shortcuts必须是一个数组' })
  }

  // 如果存在错误，返回验证结果
  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // 创建清理后的配置（只包含有效字段）
  const cleanedConfig: AppConfigV2 = {
    version: '2.0',
    general: { ...getDefaultAppConfigV2().general, ...config.general },
    appearance: { ...getDefaultAppConfigV2().appearance, ...config.appearance },
    editor: { ...getDefaultAppConfigV2().editor, ...config.editor },
    data: { ...getDefaultAppConfigV2().data, ...config.data },
    plugins: { ...getDefaultAppConfigV2().plugins, ...config.plugins },
    advanced: { ...getDefaultAppConfigV2().advanced, ...config.advanced },
    shortcuts: Array.isArray(config.shortcuts) ? config.shortcuts : [],
    recentFiles: Array.isArray(config.recentFiles) ? config.recentFiles : [],
    meta: config.meta || getDefaultAppConfigV2().meta
  }

  return { valid: true, errors: [], cleanedConfig }
}

// ==================== 导出类型别名 ====================

/**
 * 主配置类型（始终使用V2版本）
 */
export type AppConfig = AppConfigV2

/**
 * 配置类别键名
 */
export type ConfigCategory =
  | 'general'
  | 'appearance'
  | 'editor'
  | 'data'
  | 'plugins'
  | 'advanced'
  | 'shortcuts'

/**
 * 配置更新操作
 */
export interface ConfigUpdate<T extends ConfigCategory = ConfigCategory> {
  /** 配置类别 */
  category: T
  /** 更新内容 */
  updates: Partial<AppConfigV2[T]>
}
