import { autoUpdater, UpdateInfo as ElectronUpdateInfo } from 'electron-updater'
import { app, BrowserWindow, dialog } from 'electron'
import {
  UpdateInfo,
  UpdateProgress,
  UpdateState,
  UpdateError,
  UpdateStatus,
  CheckUpdateOptions
} from '../../shared/types/update'

/**
 * 应用更新服务
 * 封装 electron-updater 提供应用自动更新功能
 */
export class UpdateService {
  private mainWindow: BrowserWindow | null = null
  private status: UpdateStatus = {
    state: UpdateState.IDLE
  }
  private checkOptions: CheckUpdateOptions = {}

  constructor() {
    this.setupAutoUpdater()
  }

  /**
   * 设置主窗口引用（用于发送更新事件）
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 配置自动更新器
   */
  private setupAutoUpdater(): void {
    // 开发模式下启用调试（可选）
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.logger = console
    }

    // 禁止自动下载（让用户手动确认）
    autoUpdater.autoDownload = false

    // 禁止自动安装（用户手动触发）
    autoUpdater.autoInstallOnAppQuit = false

    // 检查更新事件
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({
        state: UpdateState.CHECKING
      })
      this.notifyRenderer('checking-for-update')
    })

    // 有可用更新
    autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      const updateInfo: UpdateInfo = {
        hasUpdate: true,
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        releaseNotes: info.releaseNotes as string | undefined,
        releaseDate: info.releaseDate
      }

      this.updateStatus({
        state: UpdateState.AVAILABLE,
        info: updateInfo
      })

      this.notifyRenderer('update-available', updateInfo)

      // 静默检查模式下显示通知
      if (this.checkOptions.silent) {
        this.showUpdateNotification(updateInfo)
      }
    })

    // 没有可用更新
    autoUpdater.on('update-not-available', () => {
      this.updateStatus({
        state: UpdateState.NOT_AVAILABLE,
        info: {
          hasUpdate: false,
          currentVersion: app.getVersion()
        }
      })
      this.notifyRenderer('update-not-available')
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      const updateProgress: UpdateProgress = {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond
      }

      this.updateStatus({
        ...this.status,
        state: UpdateState.DOWNLOADING,
        progress: updateProgress
      })

      this.notifyRenderer('download-progress', updateProgress)
    })

    // 下载完成
    autoUpdater.on('update-downloaded', () => {
      this.updateStatus({
        ...this.status,
        state: UpdateState.DOWNLOADED
      })
      this.notifyRenderer('update-downloaded')
    })

    // 错误处理
    autoUpdater.on('error', (error) => {
      const updateError: UpdateError = {
        code: 'UPDATE_ERROR',
        message: error.message,
        details: error.stack
      }

      this.updateStatus({
        state: UpdateState.ERROR,
        error: updateError
      })

      this.notifyRenderer('update-error', updateError)

      // 非静默模式下显示错误
      if (!this.checkOptions.silent) {
        dialog.showErrorBox('更新错误', `检查更新失败: ${error.message}`)
      }
    })
  }

  /**
   * 更新状态
   */
  private updateStatus(status: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...status }
  }

  /**
   * 通知渲染进程
   */
  private notifyRenderer(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`update:${channel}`, data)
    }
  }

  /**
   * 显示系统通知
   */
  private showUpdateNotification(updateInfo: UpdateInfo): void {
    const notification = {
      title: '发现新版本',
      body: `发现新版本 ${updateInfo.latestVersion}，请在设置中查看详情。`,
      icon: undefined
    }

    // 使用系统通知（如果支持）
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update:show-notification', notification)
    }
  }

  /**
   * 检查更新
   */
  async checkForUpdates(options: CheckUpdateOptions = {}): Promise<UpdateInfo> {
    // 开发模式下跳过更新检查
    if (process.env.NODE_ENV === 'development' && !process.env.FORCE_UPDATE_CHECK) {
      console.log('[UpdateService] 开发模式，跳过更新检查')
      return {
        hasUpdate: false,
        currentVersion: app.getVersion()
      }
    }

    this.checkOptions = options

    try {
      const result = await autoUpdater.checkForUpdates()

      if (!result) {
        return {
          hasUpdate: false,
          currentVersion: app.getVersion()
        }
      }

      return {
        hasUpdate: result.updateInfo.version !== app.getVersion(),
        currentVersion: app.getVersion(),
        latestVersion: result.updateInfo.version,
        releaseNotes: result.updateInfo.releaseNotes as string | undefined,
        releaseDate: result.updateInfo.releaseDate
      }
    } catch (error) {
      const updateError: UpdateError = {
        code: 'CHECK_ERROR',
        message: error instanceof Error ? error.message : '检查更新失败'
      }

      this.updateStatus({
        state: UpdateState.ERROR,
        error: updateError
      })

      throw updateError
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate(): Promise<void> {
    if (this.status.state !== UpdateState.AVAILABLE) {
      throw new Error('没有可用的更新')
    }

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      const updateError: UpdateError = {
        code: 'DOWNLOAD_ERROR',
        message: error instanceof Error ? error.message : '下载更新失败'
      }

      this.updateStatus({
        state: UpdateState.ERROR,
        error: updateError
      })

      throw updateError
    }
  }

  /**
   * 安装更新
   */
  installUpdate(): void {
    if (this.status.state !== UpdateState.DOWNLOADED) {
      throw new Error('更新尚未下载完成')
    }

    autoUpdater.quitAndInstall(false, true)
  }

  /**
   * 取消更新
   */
  cancelUpdate(): void {
    // electron-updater 不支持取消下载，只能重置状态
    this.updateStatus({
      state: UpdateState.IDLE
    })
  }

  /**
   * 获取当前更新状态
   */
  getUpdateInfo(): UpdateStatus {
    return this.status
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): string {
    return app.getVersion()
  }

  /**
   * 是否在检查更新中
   */
  isChecking(): boolean {
    return this.status.state === UpdateState.CHECKING
  }

  /**
   * 是否有可用更新
   */
  hasUpdate(): boolean {
    return this.status.state === UpdateState.AVAILABLE
  }

  /**
   * 是否正在下载
   */
  isDownloading(): boolean {
    return this.status.state === UpdateState.DOWNLOADING
  }

  /**
   * 是否已下载完成
   */
  isDownloaded(): boolean {
    return this.status.state === UpdateState.DOWNLOADED
  }
}

// 导出单例
export const updateService = new UpdateService()
