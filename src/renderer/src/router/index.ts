import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'

// 导入视图组件
import EntitiesView from '@/views/EntitiesView.vue'
import DashboardsView from '@/views/DashboardsView.vue'
import PluginsView from '@/views/PluginsView.vue'
import SettingsView from '@/views/SettingsView.vue'

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        redirect: '/entities'
      },
      {
        path: 'entities',
        name: 'Entities',
        component: EntitiesView,
        meta: {
          title: '实体管理',
          icon: 'List'
        }
      },
      {
        path: 'dashboards',
        name: 'Dashboards',
        component: DashboardsView,
        meta: {
          title: '数据看板',
          icon: 'DataAnalysis'
        }
      },
      {
        path: 'plugins',
        name: 'Plugins',
        component: PluginsView,
        meta: {
          title: '插件管理',
          icon: 'Grid'
        }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: SettingsView,
        meta: {
          title: '设置',
          icon: 'Setting'
        }
      }
    ]
  },
  // 404页面
  {
    path: '/:pathMatch(.*)*',
    redirect: '/entities'
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 全局路由守卫
router.beforeEach((_to, _from, next) => {
  // 可以在这里添加权限控制、登录验证等逻辑
  next()
})

export default router
