import { app } from 'electron'
import * as os from 'os'
import * as fs from 'fs/promises'
import * as path from 'path'
import { GitService } from './GitService'

export interface LogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  source?: string
  metadata?: Record<string, any>
}

export type LogLevel = LogEntry['level']

export class SystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'SystemError'
  }
}

export class SystemService {
  private readonly logFilePath: string
  private readonly logsDir: string
  private reloadWindowHandler: (() => void) | null = null
  private gitService: GitService
  private static instance: SystemService

  constructor() {
    this.logsDir = app.getPath('logs')
    this.logFilePath = path.join(this.logsDir, 'log.json')
    this.gitService = new GitService()
    this.ensureLogsDirectory()
  }

  static getInstance(): SystemService {
    if (!SystemService.instance) {
      SystemService.instance = new SystemService()
    }
    return SystemService.instance
  }

  private async ensureLogsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create logs directory:', error)
    }
  }

  static async logError(
    error: unknown,
    source: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const instance = SystemService.getInstance()
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    await instance.log('error', errorMessage, source, {
      ...metadata,
      stack: errorStack,
      timestamp: new Date().toISOString()
    })
  }

  static async logInfo(
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const instance = SystemService.getInstance()
    await instance.log('info', message, source, metadata)
  }

  static async logWarn(
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const instance = SystemService.getInstance()
    await instance.log('warn', message, source, metadata)
  }

  setReloadWindowHandler(handler: () => void): void {
    this.reloadWindowHandler = handler
  }

  private async readLogsFromFile(): Promise<LogEntry[]> {
    try {
      const data = await fs.readFile(this.logFilePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      // 文件不存在或格式错误，返回空数组
      return []
    }
  }

  private async writeLogsToFile(logs: LogEntry[]): Promise<void> {
    try {
      const data = JSON.stringify(logs, null, 2)
      await fs.writeFile(this.logFilePath, data, 'utf-8')
    } catch (error) {
      console.error('Failed to write logs to file:', error)
      throw new SystemError(
        'Failed to write logs to file',
        'LOG_WRITE_ERROR',
        error instanceof Error ? error : undefined
      )
    }
  }

  private async addLogEntry(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: Date.now()
    }

    const logs = await this.readLogsFromFile()
    logs.push(fullEntry)

    // 限制日志文件大小，保留最近1000条日志
    const maxLogs = 1000
    if (logs.length > maxLogs) {
      logs.splice(0, logs.length - maxLogs)
    }

    await this.writeLogsToFile(logs)
  }

  public async log(
    level: string,
    message: string,
    source?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const normalizedLevel = validLevels.includes(level as LogLevel) ? (level as LogLevel) : 'info'

    await this.addLogEntry({ level: normalizedLevel, message, source, metadata })
  }

  async getInfo(): Promise<any> {
    return {
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.version,
      appVersion: app.getVersion(),
      appName: app.getName(),
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      homePath: app.getPath('home'),
      tempPath: app.getPath('temp'),
      os: {
        type: os.type(),
        release: os.release(),
        version: os.version(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length
      }
    }
  }

  async getStats(): Promise<any> {
    const userDataPath = app.getPath('userData')
    const configPath = path.join(userDataPath, 'config.json')

    let configSize = 0
    try {
      const stats = await fs.stat(configPath)
      configSize = stats.size
    } catch (error) {
      // Config file doesn't exist
    }

    return {
      configSize,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now()
    }
  }

  async getLogs(level?: string, limit?: number): Promise<LogEntry[]> {
    console.log('Get logs with level:', level, 'limit:', limit)

    const logs = await this.readLogsFromFile()

    // 过滤日志级别
    let filteredLogs = logs
    if (level) {
      const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 }
      const targetLevel = level.toLowerCase() as LogLevel
      if (levelOrder[targetLevel] !== undefined) {
        filteredLogs = logs.filter((log) => levelOrder[log.level] >= levelOrder[targetLevel])
      }
    }

    // 按时间戳降序排序（最新的在前）
    filteredLogs.sort((a, b) => b.timestamp - a.timestamp)

    // 应用数量限制
    if (limit && limit > 0) {
      filteredLogs = filteredLogs.slice(0, limit)
    }

    return filteredLogs
  }

  async clearLogs(): Promise<void> {
    try {
      await fs.writeFile(this.logFilePath, JSON.stringify([]), 'utf-8')
    } catch (error) {
      console.error('Failed to clear logs:', error)
      throw new SystemError(
        'Failed to clear logs',
        'LOG_CLEAR_ERROR',
        error instanceof Error ? error : undefined
      )
    }
  }

  async reload(): Promise<void> {
    if (this.reloadWindowHandler) {
      this.reloadWindowHandler()
    } else {
      console.warn('No reload window handler set. Window reload is not available.')
      // 作为后备方案，我们可以尝试发送一个IPC事件或执行其他操作
      // 但目前只是记录警告
    }
  }

  async restart(): Promise<void> {
    app.relaunch()
    app.exit(0)
  }

  async exportSystemData(): Promise<{
    info: any
    stats: any
    logs: LogEntry[]
    timestamp: number
    exportVersion: string
  }> {
    const [info, stats, logs] = await Promise.all([
      this.getInfo(),
      this.getStats(),
      this.getLogs() // 获取所有日志，不进行过滤
    ])

    return {
      info,
      stats,
      logs,
      timestamp: Date.now(),
      exportVersion: '1.0'
    }
  }

  async exportToFile(filePath: string): Promise<void> {
    try {
      const data = await this.exportSystemData()
      const jsonString = JSON.stringify(data, null, 2)
      await fs.writeFile(filePath, jsonString, 'utf-8')
    } catch (error) {
      console.error('Failed to export system data:', error)
      throw new SystemError(
        'Failed to export system data',
        'EXPORT_ERROR',
        error instanceof Error ? error : undefined
      )
    }
  }

  async getGitRepositoryInfo(): Promise<{
    url: string
    branch: string
    commit: string
    hasChanges: boolean
  } | null> {
    try {
      const appPath = app.getAppPath()
      const isRepo = await this.gitService.isGitRepository(appPath)

      if (!isRepo) {
        return null
      }

      const info = await this.gitService.getRepositoryInfo(appPath)
      return {
        url: info.url || 'https://github.com/yourusername/entity-manager',
        branch: info.branch || 'main',
        commit: info.commit?.substring(0, 8) || 'unknown',
        hasChanges: info.hasChanges
      }
    } catch (error) {
      console.error('Failed to get git repository info:', error)
      return null
    }
  }

  async quit(): Promise<void> {
    app.quit()
  }
}
