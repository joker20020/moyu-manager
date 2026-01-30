import {
  Dashboard,
  Widget,
  WidgetType,
  DashboardQuery,
  WidgetQuery
} from '../../shared/types/dashboards'

// Re-export for backward compatibility
export type { Dashboard, Widget }

export class DashboardService {
  private dashboards: Map<string, Dashboard> = new Map()
  private widgets: Map<string, Widget> = new Map()

  constructor() {
    this.initializeDefaultDashboards()
  }

  reset(): void {
    this.dashboards.clear()
    this.widgets.clear()
    this.initializeDefaultDashboards()
  }

  importDashboards(dashboards: Dashboard[], widgets: Widget[]): void {
    this.dashboards.clear()
    this.widgets.clear()

    dashboards.forEach((dashboard) => {
      this.dashboards.set(dashboard.id, dashboard)
    })

    widgets.forEach((widget) => {
      this.widgets.set(widget.id, widget)
    })
  }

  private initializeDefaultDashboards(): void {
    const defaultDashboard: Dashboard = {
      id: 'default',
      name: '默认看板',
      description: '系统默认看板',
      layout: 'grid',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    this.dashboards.set(defaultDashboard.id, defaultDashboard)

    // Add some default widgets
    const defaultWidgets: Widget[] = [
      {
        id: 'stats',
        dashboardId: 'default',
        type: WidgetType.STATISTICS,
        config: {
          title: '实体统计',
          entityType: 'all',
          metrics: ['total-entities', 'by-type', 'recent-activity']
        },
        position: { x: 0, y: 0, w: 2, h: 1 }
      },
      {
        id: 'recent',
        dashboardId: 'default',
        type: WidgetType.RECENT_ENTITIES,
        config: { title: '最近实体', limit: 10, entityType: 'all' },
        position: { x: 6, y: 0, w: 2, h: 1 }
      }
    ]

    defaultWidgets.forEach((widget) => this.widgets.set(widget.id, widget))
  }

  async getDashboards(query?: DashboardQuery): Promise<Dashboard[]> {
    let dashboards = Array.from(this.dashboards.values())

    if (query?.search) {
      const searchLower = query.search.toLowerCase()
      dashboards = dashboards.filter(
        (dashboard) =>
          dashboard.name.toLowerCase().includes(searchLower) ||
          (dashboard.description && dashboard.description.toLowerCase().includes(searchLower))
      )
    }

    if (query?.sortBy) {
      dashboards.sort((a, b) => {
        const aVal = a[query.sortBy!]
        const bVal = b[query.sortBy!]
        if (aVal === bVal) return 0
        if (aVal === undefined) return 1
        if (bVal === undefined) return -1
        return aVal > bVal ? 1 : -1
      })

      if (query.sortOrder === 'desc') {
        dashboards.reverse()
      }
    }

    if (query?.offset !== undefined) {
      dashboards = dashboards.slice(query.offset)
    }

    if (query?.limit !== undefined) {
      dashboards = dashboards.slice(0, query.limit)
    }

    return dashboards
  }

  async getDashboard(id: string): Promise<Dashboard | undefined> {
    return this.dashboards.get(id)
  }

  async createDashboard(
    dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Dashboard> {
    const id = `dashboard_${Date.now()}`
    const now = Date.now()
    const dashboard: Dashboard = {
      ...dashboardData,
      id,
      createdAt: now,
      updatedAt: now
    }
    this.dashboards.set(id, dashboard)
    return dashboard
  }

  async updateDashboard(id: string, updates: Partial<Dashboard>): Promise<Dashboard | undefined> {
    const existing = this.dashboards.get(id)
    if (!existing) return undefined

    const updatedDashboard: Dashboard = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    }
    this.dashboards.set(id, updatedDashboard)
    return updatedDashboard
  }

  async deleteDashboard(id: string): Promise<boolean> {
    Array.from(this.widgets.values())
      .filter((widget) => widget.dashboardId === id)
      .forEach((widget) => this.widgets.delete(widget.id))

    return this.dashboards.delete(id)
  }

  async getWidgets(dashboardId: string): Promise<Widget[]> {
    return Array.from(this.widgets.values()).filter((widget) => widget.dashboardId === dashboardId)
  }

  async getAllWidgets(): Promise<Widget[]> {
    return Array.from(this.widgets.values())
  }

  async addWidget(
    dashboardId: string,
    widgetData: Omit<Widget, 'id' | 'dashboardId'>
  ): Promise<Widget> {
    const id = `widget_${Date.now()}`
    const widget: Widget = {
      ...widgetData,
      id,
      dashboardId
    }
    this.widgets.set(id, widget)
    return widget
  }

  async removeWidget(dashboardId: string, widgetId: string): Promise<boolean> {
    const widget = this.widgets.get(widgetId)
    if (!widget || widget.dashboardId !== dashboardId) return false
    return this.widgets.delete(widgetId)
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Partial<Widget>
  ): Promise<Widget | undefined> {
    const widget = this.widgets.get(widgetId)
    if (!widget || widget.dashboardId !== dashboardId) return undefined

    const updatedWidget: Widget = {
      ...widget,
      ...updates
    }
    this.widgets.set(widgetId, updatedWidget)
    return updatedWidget
  }

  async batchCreateDashboards(
    dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<Dashboard[]> {
    const created: Dashboard[] = []
    const now = Date.now()

    dashboardData.forEach((data, index) => {
      const id = `dashboard_${now}_${index}`
      const dashboard: Dashboard = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now
      }
      this.dashboards.set(id, dashboard)
      created.push(dashboard)
    })

    return created
  }

  async batchDeleteDashboards(ids: string[]): Promise<number> {
    let deletedCount = 0

    ids.forEach((id) => {
      if (this.dashboards.delete(id)) {
        // 删除关联的小部件
        Array.from(this.widgets.values())
          .filter((widget) => widget.dashboardId === id)
          .forEach((widget) => this.widgets.delete(widget.id))
        deletedCount++
      }
    })

    return deletedCount
  }

  async searchDashboards(query: DashboardQuery): Promise<Dashboard[]> {
    return this.getDashboards(query)
  }

  async searchWidgets(query: WidgetQuery): Promise<Widget[]> {
    let widgets = Array.from(this.widgets.values())

    if (query.dashboardId) {
      widgets = widgets.filter((widget) => widget.dashboardId === query.dashboardId)
    }

    if (query.type) {
      widgets = widgets.filter((widget) => widget.type === query.type)
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase()
      widgets = widgets.filter((widget) => {
        const configStr = JSON.stringify(widget.config).toLowerCase()
        return configStr.includes(searchLower)
      })
    }

    return widgets
  }
}
