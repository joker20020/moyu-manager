import type { EntityType, EntityInstance, EntityQuery } from '../../shared/types/entities'
import { FIXED_FIELDS } from '../../shared/types/entities'
import * as fs from 'fs/promises'
import { SystemService } from './SystemService'
import Fuse from 'fuse.js'

export class EntityService {
  // In-memory storage
  private entityTypes: Map<string, EntityType> = new Map()
  private entityInstances: Map<string, EntityInstance> = new Map()
  private nextEntityId: number = 1

  constructor() {
    this.initializeDefaultTypes()
  }

  reset(): void {
    this.entityTypes.clear()
    this.entityInstances.clear()
    this.nextEntityId = 1
    this.initializeDefaultTypes()
  }

  private initializeDefaultTypes(): void {
    // Create default entity types
    const defaultTypes: EntityType[] = [
      {
        id: 'task',
        name: '任务',
        description: '任务管理',
        icon: 'Notification',
        color: '#8a6df7',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [
          {
            id: 'priority',
            name: '优先级',
            type: 'select',
            options: ['高', '中', '低'],
            defaultValue: '中'
          },
          {
            id: 'status',
            name: '状态',
            type: 'select',
            options: ['待办', '进行中', '已完成', '已取消'],
            defaultValue: '待办'
          },
          { id: 'dueDate', name: '截止日期', type: 'date' },
          { id: 'description', name: '描述', type: 'text' },
          { id: 'tags', name: '标签', type: 'text' }
        ],
        fixedFields: FIXED_FIELDS
      },
      {
        id: 'contact',
        name: '联系人',
        description: '联系人管理',
        icon: 'User',
        color: '#3498db',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [
          { id: 'email', name: '邮箱', type: 'text', required: true },
          { id: 'phone', name: '电话', type: 'text' },
          { id: 'company', name: '公司', type: 'text' },
          { id: 'position', name: '职位', type: 'text' },
          { id: 'notes', name: '备注', type: 'text' }
        ],
        fixedFields: FIXED_FIELDS
      },
      {
        id: 'note',
        name: '笔记',
        description: '笔记管理',
        icon: 'Notebook',
        color: '#2ecc71',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [
          { id: 'content', name: '内容', type: 'text', required: true },
          {
            id: 'category',
            name: '分类',
            type: 'select',
            options: ['工作', '个人', '学习', '其他']
          },
          { id: 'attachment', name: '附件', type: 'text' }
        ],
        fixedFields: FIXED_FIELDS
      }
    ]

    defaultTypes.forEach((type) => this.entityTypes.set(type.id, type))
  }

  // Entity Type Management
  getEntityTypes(): EntityType[] {
    return Array.from(this.entityTypes.values())
  }

  getEntityType(id: string): EntityType | undefined {
    return this.entityTypes.get(id)
  }

  createEntityType(typeData: Omit<EntityType, 'id' | 'createdAt' | 'updatedAt'>): EntityType {
    const id = typeData.name.toLowerCase().replace(/\s+/g, '-')
    const now = Date.now()
    const newType: EntityType = {
      ...typeData,
      id,
      createdAt: now,
      updatedAt: now
    }
    this.entityTypes.set(id, newType)
    return newType
  }

  updateEntityType(id: string, updates: Partial<EntityType>): EntityType | undefined {
    const existing = this.entityTypes.get(id)
    if (!existing) return undefined

    const updatedType: EntityType = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    }
    this.entityTypes.set(id, updatedType)
    return updatedType
  }

  deleteEntityType(id: string): boolean {
    // Check if there are instances of this type
    const hasInstances = Array.from(this.entityInstances.values()).some(
      (instance) => instance._type === id
    )
    if (hasInstances) {
      return false
      // throw new Error(`Cannot delete entity type "${id}" because there are existing instances`)
    }
    return this.entityTypes.delete(id)
  }

  // Import entity type with existing ID (for file loading)
  importEntityType(type: EntityType): void {
    this.entityTypes.set(type.id, type)
  }

  // Entity Instance Management
  getEntities(query?: EntityQuery): EntityInstance[] {
    let instances = Array.from(this.entityInstances.values())

    if (query?.ids) {
      instances = instances.filter((instance) => query.ids!.includes(instance._id))
    }

    if (query?.type) {
      instances = instances.filter((instance) => instance._type === query.type)
    }

    if (query?.search) {
      const searchLower = query.search.toLowerCase()
      instances = instances.filter((instance) => {
        return Object.entries(instance).some(([key, value]) => {
          if (key.startsWith('_')) return false
          return String(value).toLowerCase().includes(searchLower)
        })
      })
    }

    if (query?.filters) {
      instances = instances.filter((instance) => {
        return Object.entries(query.filters!).every(([key, value]) => {
          return instance[key] === value
        })
      })
    }

    if (query?.sortBy) {
      instances.sort((a, b) => {
        const aVal = a[query.sortBy!]
        const bVal = b[query.sortBy!]
        if (aVal === bVal) return 0
        if (aVal === undefined) return 1
        if (bVal === undefined) return -1
        return aVal > bVal ? 1 : -1
      })
      if (query.sortOrder === 'desc') {
        instances.reverse()
      }
    }

    if (query?.offset !== undefined) {
      instances = instances.slice(query.offset)
    }

    if (query?.limit !== undefined) {
      instances = instances.slice(0, query.limit)
    }

    return instances
  }

  getEntity(id: string): EntityInstance | undefined {
    return this.entityInstances.get(id)
  }

  createEntity(entityData: Partial<EntityInstance>): EntityInstance {
    const entityType = this.entityTypes.get(entityData._type!)
    if (!entityType) {
      throw new Error(`Entity type "${entityData._type}" not found`)
    }

    const id = `entity_${Date.now()}_${this.nextEntityId++}`
    const now = Date.now()

    const newEntity: EntityInstance = {
      _id: id,
      _type: entityData._type!,
      name: entityData.name || `未命名实体`,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
      ...entityData
    }

    // Ensure required fields have values
    entityType.fields.forEach((field) => {
      if (field.required && newEntity[field.id] === undefined) {
        newEntity[field.id] = field.defaultValue ?? ''
      }
    })

    this.entityInstances.set(id, newEntity)
    return newEntity
  }

  updateEntity(id: string, updates: Partial<EntityInstance>): EntityInstance | undefined {
    const existing = this.entityInstances.get(id)
    if (!existing) return undefined

    const updatedEntity: EntityInstance = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
      updatedBy: 'system'
    }

    this.entityInstances.set(id, updatedEntity)
    return updatedEntity
  }

  deleteEntity(id: string): boolean {
    return this.entityInstances.delete(id)
  }

  batchDelete(ids: string[]): number {
    let deletedCount = 0
    ids.forEach((id) => {
      if (this.entityInstances.delete(id)) {
        deletedCount++
      }
    })
    return deletedCount
  }

  // Search and count
  search(query: string): EntityInstance[] {
    // 空查询返回空结果
    if (!query.trim()) {
      return []
    }

    const entities = Array.from(this.entityInstances.values())
    if (entities.length === 0) {
      return []
    }

    // 收集所有非系统字段（不以_开头）
    const fieldSet = new Set<string>()
    entities.forEach((entity) => {
      Object.keys(entity).forEach((key) => {
        if (!key.startsWith('_')) {
          fieldSet.add(key)
        }
      })
    })

    const keys = Array.from(fieldSet)

    // 如果没有任何可搜索字段，返回空结果
    if (keys.length === 0) {
      return []
    }

    // 配置Fuse.js选项
    const options = {
      keys,
      includeScore: true,
      threshold: 0.4, // 模糊匹配阈值，值越小越严格
      ignoreLocation: false,
      minMatchCharLength: 1,
      shouldSort: true,
      // 字段权重：name字段权重更高
      fieldNormWeight: 1
    }

    const fuse = new Fuse(entities, options)
    const results = fuse.search(query)

    // 返回原始实体（不带Fuse的包装对象）
    return results.map((result) => result.item)
  }

  count(query?: EntityQuery): number {
    return this.getEntities(query).length
  }

  // Export/Import (simplified)
  async exportEntities(filePath: string, query?: EntityQuery): Promise<string> {
    const entities = this.getEntities(query)
    const jsonString = JSON.stringify(entities, null, 2)
    await fs.writeFile(filePath, jsonString, 'utf-8')
    return jsonString
  }

  async importEntities(filePath: string): Promise<number> {
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      const entities: EntityInstance[] = JSON.parse(data)
      let importedCount = 0

      entities.forEach((entity) => {
        if (entity._id && entity._type) {
          this.entityInstances.set(entity._id, entity)
          importedCount++
        }
      })

      return importedCount
    } catch (error) {
      SystemService.logError(error, 'EntityService.importEntities')
      return 0
      // throw new Error(`Failed to import entities: ${error}`)
    }
  }

  importEntitiesFromString(data: string): number {
    try {
      const entities: EntityInstance[] = JSON.parse(data)
      let importedCount = 0

      entities.forEach((entity) => {
        if (entity._id && entity._type) {
          this.entityInstances.set(entity._id, entity)
          importedCount++
        }
      })

      return importedCount
    } catch (error) {
      SystemService.logError(error, 'EntityService.importEntitiesFromString')
      return 0
    }
  }
}
