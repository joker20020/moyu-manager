// 看板和小部件类型定义

// 看板接口
export interface Dashboard {
  id: string
  name: string
  description?: string
  layout: string
  createdAt: number
  updatedAt: number
}

// 小部件位置
export interface WidgetPosition {
  x: number
  y: number
  w: number
  h: number
}

// 小部件配置接口
export interface WidgetConfig {
  title: string
  [key: string]: any
}

// 基础小部件接口
export interface Widget {
  id: string
  dashboardId: string
  type: WidgetType
  config: WidgetConfig
  position: WidgetPosition
}

// 小部件类型枚举
export enum WidgetType {
  STATISTICS = 'statistics',
  RECENT_ENTITIES = 'recent-entities',
  ENTITY_DISTRIBUTION = 'entity-distribution',
  TREND_CHART = 'trend-chart',
  ENTITY_TABLE = 'entity-table',
  CUSTOM = 'custom'
}

// 小部件配置类型定义

// 统计小部件配置
export interface StatisticsWidgetConfig extends WidgetConfig {
  metrics: StatisticMetric[]
  entityType?: string
  refreshInterval?: number
}

export type StatisticMetric = 'total-entities' | 'by-type' | 'recent-activity'

// 最近实体小部件配置
export interface RecentEntitiesWidgetConfig extends WidgetConfig {
  entityType?: string
  limit: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
  showColumns?: string[]
}

// 实体分布小部件配置
export interface EntityDistributionWidgetConfig extends WidgetConfig {
  entityType: string
  distributionField: string
  chartType: 'pie' | 'bar' | 'doughnut'
  showPercentages: boolean
}

// 趋势图表小部件配置
export interface TrendChartWidgetConfig extends WidgetConfig {
  entityType: string
  chartType: 'line' | 'area' | 'bar'
  // 以下字段已弃用，保持可选以向后兼容
  metricField?: string
  timeRange?: 'day' | 'week' | 'month' | 'year'
}

// 实体表格小部件配置
export interface EntityTableWidgetConfig extends WidgetConfig {
  entityType: string
  columns: string[]
  pageSize: number
  enableSorting: boolean
  enableFiltering: boolean
}

// 看板操作结果
export interface DashboardOperationResult {
  success: boolean
  message?: string
  data?: Dashboard | Dashboard[]
  error?: string
}

// 小部件操作结果
export interface WidgetOperationResult {
  success: boolean
  message?: string
  data?: Widget | Widget[]
  error?: string
}

// 看板查询参数
export interface DashboardQuery {
  search?: string
  sortBy?: keyof Dashboard
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// 小部件查询参数
export interface WidgetQuery {
  dashboardId?: string
  type?: WidgetType
  search?: string
}
