// 实体字段类型
export type EntityFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean'

// 实体字段定义
export interface EntityField {
  id: string
  name: string
  type: EntityFieldType
  required?: boolean
  defaultValue?: any
  options?: string[]
  description?: string
}

// 实体类型定义
export interface EntityType {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  createdAt: number
  updatedAt: number
  fields: EntityField[]
  fixedFields: EntityField[]
}

// 实体实例
export interface EntityInstance {
  _id: string
  _type: string
  [key: string]: any
}

// 实体查询参数
export interface EntityQuery {
  ids?: string[]
  type?: string
  search?: string
  filters?: Record<string, any>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// 实体操作结果
export interface EntityOperationResult {
  success: boolean
  message?: string
  data?: EntityInstance | EntityInstance[]
  error?: string
}

// 固定字段
export const FIXED_FIELDS: EntityField[] = [
  { id: '_id', name: 'ID', type: 'text', required: true, description: '实体唯一标识符' },
  { id: '_type', name: '类型', type: 'text', required: true, description: '实体类型' },
  { id: 'name', name: '名称', type: 'text', required: true, description: '实体显示名称' },
  {
    id: 'createdAt',
    name: '创建时间',
    type: 'date',
    required: true,
    description: '实体创建时间戳'
  },
  {
    id: 'updatedAt',
    name: '更新时间',
    type: 'date',
    required: true,
    description: '实体最后更新时间戳'
  },
  { id: 'createdBy', name: '创建者', type: 'text', description: '实体创建者标识' },
  { id: 'updatedBy', name: '更新者', type: 'text', description: '实体最后更新者标识' }
]
