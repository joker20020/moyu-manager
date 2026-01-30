/**
 * 应用自动更新相关类型定义
 */

/**
 * 更新信息
 */
export interface UpdateInfo {
  /** 是否有可用更新 */
  hasUpdate: boolean
  /** 当前版本 */
  currentVersion: string
  /** 最新版本 */
  latestVersion?: string
  /** 更新说明 */
  releaseNotes?: string
  /** 发布日期 */
  releaseDate?: string
  /** 下载链接 */
  downloadUrl?: string
}

/**
 * 更新进度信息
 */
export interface UpdateProgress {
  /** 下载百分比 (0-100) */
  percent: number
  /** 已下载字节数 */
  transferred: number
  /** 总字节数 */
  total: number
  /** 下载速度 (bytes/second) */
  bytesPerSecond: number
}

/**
 * 更新状态
 */
export enum UpdateState {
  /** 空闲状态 */
  IDLE = 'idle',
  /** 正在检查更新 */
  CHECKING = 'checking',
  /** 有可用更新 */
  AVAILABLE = 'available',
  /** 没有可用更新 */
  NOT_AVAILABLE = 'not_available',
  /** 正在下载 */
  DOWNLOADING = 'downloading',
  /** 下载完成 */
  DOWNLOADED = 'downloaded',
  /** 更新错误 */
  ERROR = 'error'
}

/**
 * 更新错误信息
 */
export interface UpdateError {
  /** 错误代码 */
  code: string
  /** 错误消息 */
  message: string
  /** 错误详情 */
  details?: any
}

/**
 * 完整更新状态
 */
export interface UpdateStatus {
  /** 当前状态 */
  state: UpdateState
  /** 更新信息 */
  info?: UpdateInfo
  /** 下载进度 */
  progress?: UpdateProgress
  /** 错误信息 */
  error?: UpdateError
}

/**
 * 更新检查选项
 */
export interface CheckUpdateOptions {
  /** 是否显示进度提示 */
  showProgress?: boolean
  /** 是否静默检查（不显示错误提示） */
  silent?: boolean
}

/**
 * 更新配置
 */
export interface UpdateConfig {
  /** 是否自动检查更新 */
  autoCheck: boolean
  /** 是否自动下载更新 */
  autoDownload: boolean
  /** 是否允许预发布版本 */
  allowPrerelease: boolean
  /** 检查频率（小时） */
  checkInterval: number
}
