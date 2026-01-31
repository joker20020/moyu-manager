import { dialog } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as zlib from 'zlib'
import { promisify } from 'util'
import type { EntityService } from './EntityService'
import type { ConfigService } from './ConfigService'
import type { DashboardService } from './DashboardService'
import type { EntityInstance } from '../../shared/types/entities'
import { SystemService } from './SystemService'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export interface EmFileData {
  meta: {
    version: string
    name: string
    created: number
    entityTypes: any[]
  }
  data: {
    entities: any[]
    settings: any
    dashboards: any[]
    widgets: any[]
  }
}

// 支持的文件格式
export type ExportFormat = 'em' | 'json' | 'csv'

// 导入导出错误类型
export class FileImportExportError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'FileImportExportError'
  }
}

export class FileService {
  private currentFilePath: string | null = null
  private entityService: EntityService
  private configService: ConfigService
  private dashboardService: DashboardService

  constructor(
    entityService: EntityService,
    configService: ConfigService,
    dashboardService: DashboardService
  ) {
    this.entityService = entityService
    this.configService = configService
    this.dashboardService = dashboardService
  }

  private async loadRecentFiles(): Promise<string[]> {
    return this.configService.get('recentFiles', [])
  }

  private async saveRecentFiles(recentFiles: string[]): Promise<void> {
    await this.configService.set('recentFiles', recentFiles)
  }

  private async addToRecentFiles(filePath: string): Promise<void> {
    const recentFiles = await this.loadRecentFiles()
    const filtered = recentFiles.filter((p) => p !== filePath)
    filtered.unshift(filePath)
    await this.saveRecentFiles(filtered.slice(0, 10))
  }

  async newFile(): Promise<string> {
    try {
      // 重置实体服务到初始状态
      this.entityService.reset()

      // 清除配置服务的相关设置（保留主题等基本配置）
      // 这里可以选择性地重置某些配置

      // 清除看板数据（如果DashboardService有reset方法）
      // this.dashboardService.reset()

      this.currentFilePath = null

      // 保存当前空状态到配置文件
      await this.saveRecentFiles([])

      return '新建文件'
    } catch (error) {
      console.error('Failed to create new file:', error)
      await SystemService.logError(error, 'FileService.newFile')
      throw new FileImportExportError('创建新文件失败', error as Error)
    }
  }

  async open(filePath?: string): Promise<boolean> {
    try {
      let targetPath = filePath
      if (!targetPath) {
        const result = await dialog.showOpenDialog({
          title: '打开 .em 文件',
          filters: [{ name: 'Entity Manager Files', extensions: ['em'] }],
          properties: ['openFile']
        })
        if (result.canceled) return false
        targetPath = result.filePaths[0]
      }

      if (!targetPath) return false

      // Read and decompress .em file
      const compressedData = await fs.readFile(targetPath)
      const decompressedData = await gunzip(compressedData)
      const fileContent = decompressedData.toString('utf-8')

      // Parse as JSON
      const data = JSON.parse(fileContent) as EmFileData

      // Load data into services
      await this.loadDataIntoServices(data)

      this.currentFilePath = targetPath
      await this.addToRecentFiles(targetPath)
      return true
    } catch (error) {
      console.error('Failed to open file:', error)
      await SystemService.logError(error, 'FileService.open')
      return false
    }
  }

  private async loadDataIntoServices(data: EmFileData): Promise<void> {
    try {
      // Reset entity service to clear existing data
      this.entityService.reset()

      // Load entity types - assumes existing types will be overwritten or should be cleared
      for (const entityType of data.meta.entityTypes) {
        this.entityService.importEntityType(entityType)
      }

      // Load entities
      this.entityService.importEntitiesFromString(JSON.stringify(data.data.entities))

      // Load dashboards and widgets
      if (data.data.dashboards && data.data.dashboards.length > 0) {
        const widgets = data.data.widgets || []
        this.dashboardService.importDashboards(data.data.dashboards, widgets)
      }
    } catch (error) {
      console.error('Failed to load data into services:', error)
      await SystemService.logError(error, 'FileService.loadDataIntoServices')
      throw error
    }
  }

  async save(filePath?: string): Promise<boolean> {
    try {
      const targetPath = filePath || this.currentFilePath
      if (!targetPath) {
        return this.saveAs().then((result) => result !== null)
      }

      // Collect data from services
      const entityTypes = this.entityService.getEntityTypes()
      const entities = this.entityService.getEntities()

      // Get config data
      const settings = {
        theme: await this.configService.getTheme(),
        autoSave: await this.configService.get('autoSave'),
        language: await this.configService.get('language'),
        recentFiles: await this.loadRecentFiles()
      }

      // Get dashboard and widget data
      const dashboards = await this.dashboardService.getDashboards()
      const widgets = await this.dashboardService.getAllWidgets()

      const data: EmFileData = {
        meta: {
          version: '1.0.0',
          name: path.basename(targetPath, '.em'),
          created: Date.now(),
          entityTypes: entityTypes
        },
        data: {
          entities: entities,
          settings: settings,
          dashboards: dashboards,
          widgets: widgets
        }
      }

      const jsonString = JSON.stringify(data, null, 2)
      const compressedData = await gzip(Buffer.from(jsonString, 'utf-8'))
      await fs.writeFile(targetPath, compressedData)

      this.currentFilePath = targetPath
      await this.addToRecentFiles(targetPath)
      return true
    } catch (error) {
      console.error('Failed to save file:', error)
      await SystemService.logError(error, 'FileService.save')
      return false
    }
  }

  async saveAs(): Promise<string | null> {
    try {
      const result = await dialog.showSaveDialog({
        title: '保存 .em 文件',
        filters: [{ name: 'Entity Manager Files', extensions: ['em'] }],
        defaultPath: '未命名.em'
      })
      if (result.canceled || !result.filePath) return null

      const saved = await this.save(result.filePath)
      return saved ? result.filePath : null
    } catch (error) {
      console.error('Failed to save as:', error)
      await SystemService.logError(error, 'FileService.saveAs')
      return null
    }
  }

  private detectFormatFromPath(filePath: string): ExportFormat {
    if (!filePath) {
      return 'json' // 默认格式
    }
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    if (ext === 'em') return 'em'
    if (ext === 'json') return 'json'
    if (ext === 'csv') return 'csv'
    return 'json' // 默认格式
  }

  private async exportAsJson(filePath: string): Promise<boolean> {
    try {
      const entityTypes = this.entityService.getEntityTypes()
      const entities = this.entityService.getEntities()

      const settings = {
        theme: await this.configService.getTheme(),
        autoSave: await this.configService.get('autoSave'),
        language: await this.configService.get('language'),
        recentFiles: await this.loadRecentFiles()
      }

      const dashboards = await this.dashboardService.getDashboards()
      const widgets = await this.dashboardService.getAllWidgets()

      const data = {
        meta: {
          version: '1.0.0',
          name: path.basename(filePath, '.json'),
          created: Date.now(),
          entityTypes
        },
        data: {
          entities,
          settings,
          dashboards,
          widgets
        }
      }

      const jsonString = JSON.stringify(data, null, 2)
      await fs.writeFile(filePath, jsonString, 'utf-8')
      await this.addToRecentFiles(filePath)
      return true
    } catch (error) {
      await SystemService.logError(error, 'FileService.exportAsJson')
      throw new FileImportExportError(`JSON导出失败: ${error}`, error as Error)
    }
  }

  private async exportAsCsv(filePath: string): Promise<boolean> {
    try {
      const entities = this.entityService.getEntities()
      if (entities.length === 0) {
        await fs.writeFile(filePath, '', 'utf-8')
        return true
      }

      // 获取所有字段
      const fields = new Set<string>()
      entities.forEach((entity) => {
        Object.keys(entity).forEach((key) => {
          if (!key.startsWith('_')) {
            fields.add(key)
          }
        })
      })

      const fieldList = Array.from(fields)
      const header = fieldList.join(',')

      const rows = entities.map((entity) => {
        const values = fieldList.map((field) => {
          const value = entity[field]
          if (value === undefined || value === null) return ''
          // CSV转义：如果包含逗号、引号或换行符，用引号括起来
          const strValue = String(value)
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`
          }
          return strValue
        })
        return values.join(',')
      })

      const csvContent = [header, ...rows].join('\n')
      await fs.writeFile(filePath, csvContent, 'utf-8')
      return true
    } catch (error) {
      await SystemService.logError(error, 'FileService.exportAsCsv')
      throw new FileImportExportError(`CSV导出失败: ${error}`, error as Error)
    }
  }

  async exportFile(filePath: string, format?: string): Promise<boolean> {
    try {
      if (!filePath || typeof filePath !== 'string') {
        console.error('导出文件失败: 文件路径无效', filePath)
        return false
      }

      const exportFormat = (format || this.detectFormatFromPath(filePath)) as ExportFormat

      switch (exportFormat) {
        case 'em':
          return this.save(filePath)
        case 'json':
          return this.exportAsJson(filePath)
        case 'csv':
          return this.exportAsCsv(filePath)
        default:
          throw new FileImportExportError(`不支持的导出格式: ${exportFormat}`)
      }
    } catch (error) {
      console.error('导出文件失败:', error)
      await SystemService.logError(error, 'FileService.exportFile')
      return false
    }
  }

  async importFile(filePath: string): Promise<boolean> {
    try {
      const format = this.detectFormatFromPath(filePath)

      switch (format) {
        case 'em':
          return this.open(filePath)
        case 'json':
          return this.importFromJson(filePath)
        case 'csv':
          return this.importFromCsv(filePath)
        default:
          throw new FileImportExportError(`不支持的导入格式: ${format}`)
      }
    } catch (error) {
      console.error('导入文件失败:', error)
      await SystemService.logError(error, 'FileService.importFile')
      return false
    }
  }

  private async importFromJson(filePath: string): Promise<boolean> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(fileContent)

      // 检查是否为有效的.em文件格式
      if (data.meta && data.data) {
        await this.loadDataIntoServices(data as EmFileData)
        await this.addToRecentFiles(filePath)
        return true
      }

      // 如果是纯实体数组，只导入实体
      if (Array.isArray(data)) {
        this.entityService.importEntitiesFromString(JSON.stringify(data))
        await this.addToRecentFiles(filePath)
        return true
      }

      throw new FileImportExportError('无效的JSON格式')
    } catch (error) {
      await SystemService.logError(error, 'FileService.importFromJson')
      throw new FileImportExportError(`JSON导入失败: ${error}`, error as Error)
    }
  }

  private async importFromCsv(filePath: string): Promise<boolean> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const lines = fileContent.split('\n').filter((line) => line.trim() !== '')

      if (lines.length < 2) {
        return true // 空文件或只有标题行
      }

      const headers = lines[0].split(',').map((h) => h.trim())
      const entities: Partial<EntityInstance>[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        const values = this.parseCsvLine(line)

        const entity: Partial<EntityInstance> = {
          _id: `imported_${Date.now()}_${i}`,
          _type: 'task',
          name: `导入实体 ${i}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: 'system',
          updatedBy: 'system'
        }

        // 映射CSV列到实体字段
        for (let j = 0; j < Math.min(headers.length, values.length); j++) {
          const header = headers[j]
          let value = values[j]

          // 移除CSV引号
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1).replace(/""/g, '"')
          }

          if (header && value !== undefined) {
            entity[header] = value
          }
        }

        entities.push(entity)
      }

      // 导入实体
      for (const entity of entities) {
        this.entityService.createEntity(entity)
      }

      await this.addToRecentFiles(filePath)
      return true
    } catch (error) {
      await SystemService.logError(error, 'FileService.importFromCsv')
      throw new FileImportExportError(`CSV导入失败: ${error}`, error as Error)
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = i < line.length - 1 ? line[i + 1] : ''

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          i++ // 跳过下一个引号
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }

    result.push(current)
    return result
  }

  async getRecentFiles(): Promise<string[]> {
    return this.loadRecentFiles()
  }

  async clearRecentFiles(): Promise<void> {
    await this.saveRecentFiles([])
  }

  getCurrentFilePath(): string | null {
    return this.currentFilePath
  }

  hasOpenedFile(): boolean {
    return this.currentFilePath !== null
  }
}
