import { PluginService } from '../../src/main/services/PluginService'
import { PluginLoader } from '../../src/main/services/PluginLoader'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { rm } from 'fs/promises'
import { PluginLifecycleState } from '../../src/shared/types/plugins'

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

interface TestSuiteResult {
  name: string;
  result: TestResult;
}

async function testEntityStatsPlugin() {
  console.log('=== 测试实体统计插件 ===')
  
  // 创建临时目录作为用户插件目录
  const tempUserDir = mkdtempSync(join(tmpdir(), 'entity-manager-stats-test-'))
  console.log(`临时用户插件目录: ${tempUserDir}`)
  
  // 创建 PluginService，依赖服务传 undefined（插件系统应该能处理）
  const pluginService = new (PluginService as any)(undefined, undefined, undefined, undefined)
  
  // 修改插件目录配置
  pluginService.pluginLoader.setPluginDirs({
    user: tempUserDir
  })
  
  // 禁用沙箱以便于测试（如果需要）
  pluginService.pluginLoader.disableSandbox()
  
  const pluginSourceDir = join(__dirname, 'your-plugin-source-directory')
  
  try {
    // 1. 安装插件
    console.log('1. 安装实体统计插件...')
    const plugin = await pluginService.installPlugin(pluginSourceDir)
    console.log(`   插件安装成功: ${plugin.manifest.id}`)
    console.log(`   插件名称: ${plugin.manifest.name}`)
    console.log(`   插件版本: ${plugin.manifest.version}`)
    console.log(`   插件权限: ${plugin.manifest.permissions?.join(', ') || '无'}`)
    
    // 验证插件清单
    if (plugin.manifest.id !== 'entity-stats') {
      throw new Error(`插件ID不匹配: 期望 entity-stats, 实际 ${plugin.manifest.id}`)
    }
    
    if (plugin.manifest.name !== '实体统计插件') {
      throw new Error(`插件名称不匹配: 期望 '实体统计插件', 实际 ${plugin.manifest.name}`)
    }
    
    // 2. 获取插件列表
    console.log('2. 获取插件列表...')
    const plugins = await pluginService.getPlugins()
    console.log(`   插件数量: ${plugins.length}`)
    const installedPlugin = plugins.find((p: any) => p.manifest.id === 'entity-stats')
    if (!installedPlugin) {
      throw new Error('安装的插件未在插件列表中找到')
    }
    console.log(`   找到插件: ${installedPlugin.manifest.name}`)
    
    // 3. 检查插件状态（应该是UNLOADED）
    console.log('3. 检查初始状态...')
    const initialState = await pluginService.getPluginState('entity-stats')
    if (initialState !== PluginLifecycleState.UNLOADED) {
      throw new Error(`初始状态应为UNLOADED, 实际为 ${initialState}`)
    }
    console.log(`   初始状态正确: ${initialState}`)
    
    // 4. 加载插件
    console.log('4. 加载插件...')
    const loadResult = await pluginService.loadPlugin('entity-stats')
    if (!loadResult.success) {
      throw new Error(`加载插件失败: ${loadResult.message}`)
    }
    console.log(`   插件加载成功，状态: ${loadResult.data?.newState}`)
    
    // 5. 初始化插件
    console.log('5. 初始化插件...')
    const initResult = await pluginService.initPlugin('entity-stats')
    if (!initResult.success) {
      throw new Error(`初始化插件失败: ${initResult.message}`)
    }
    console.log(`   插件初始化成功，状态: ${initResult.data?.newState}`)
    
    // 6. 获取插件配置
    console.log('6. 获取插件配置...')
    const pluginConfig = await pluginService.getPluginConfig('entity-stats')
    console.log(`   插件配置字段数量: ${pluginConfig.fields?.length || 0}`)
    console.log(`   插件配置数据: ${JSON.stringify(pluginConfig.data || {})}`)
    
    // 7. 设置插件配置
    console.log('7. 设置插件配置...')
    const testConfig = {
      fields: pluginConfig.fields || [],
      data: {
        autoRefresh: false,
        refreshInterval: 60000,
        enableNotifications: true
      }
    }
    const setConfigResult = await pluginService.setPluginConfig('entity-stats', testConfig)
    if (!setConfigResult) {
      throw new Error('设置插件配置失败')
    }
    console.log(`   插件配置设置成功`)
    
    // 8. 验证配置持久化
    console.log('8. 验证配置持久化...')
    const restoredConfig = await pluginService.getPluginConfig('entity-stats')
    if (!restoredConfig.data || restoredConfig.data.autoRefresh !== false) {
      throw new Error('配置持久化失败')
    }
    console.log(`   配置持久化验证成功`)
    
    // 9. 激活插件
    console.log('9. 激活插件...')
    const activateResult = await pluginService.activatePlugin('entity-stats')
    if (!activateResult.success) {
      throw new Error(`激活插件失败: ${activateResult.message}`)
    }
    console.log(`   插件激活成功，状态: ${activateResult.data?.newState}`)
    
    // 10. 检查插件权限
    console.log('10. 检查插件权限...')
    const permissions = await pluginService.getPermissions('entity-stats')
    console.log(`   插件权限: ${permissions.join(', ')}`)
    
    // 验证必需权限是否存在
    const requiredPermissions = ['entities:read', 'config:read', 'config:write', 'ui:show', 'events:subscribe']
    for (const perm of requiredPermissions) {
      if (!permissions.includes(perm)) {
        console.warn(`   警告: 插件缺少权限 ${perm}`)
      }
    }
    
    // 11. 停用插件
    console.log('11. 停用插件...')
    const deactivateResult = await pluginService.deactivatePlugin('entity-stats')
    if (!deactivateResult.success) {
      throw new Error(`停用插件失败: ${deactivateResult.message}`)
    }
    console.log(`   插件停用成功，状态: ${deactivateResult.data?.newState}`)
    
    // 12. 卸载插件
    console.log('12. 卸载插件...')
    const uninstallResult = await pluginService.uninstallPlugin('entity-stats')
    if (!uninstallResult) {
      throw new Error('卸载插件失败')
    }
    console.log(`   插件卸载成功`)
    
    // 13. 验证插件已移除
    console.log('13. 验证插件已移除...')
    const pluginsAfterUninstall = await pluginService.getPlugins()
    const remainingPlugin = pluginsAfterUninstall.find((p: any) => p.manifest.id === 'entity-stats')
    if (remainingPlugin) {
      throw new Error('卸载后插件仍然存在')
    }
    console.log(`   插件已成功从列表中移除`)
    
    console.log('✅ 实体统计插件完整生命周期测试通过')
    
    return {
      success: true,
      message: '实体统计插件测试通过',
      data: {
        installedAt: plugin.installedAt,
        permissions,
        config: restoredConfig
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
    return {
      success: false,
      message: `测试失败: ${(error as Error).message}`,
      error: (error as Error).stack
    }
  } finally {
    // 清理临时目录
    try {
      await rm(tempUserDir, { recursive: true, force: true })
      console.log(`已清理临时目录: ${tempUserDir}`)
    } catch (err) {
      console.warn('清理临时目录失败:', err)
    }
  }
}

async function testPluginModuleFunctionality() {
  console.log('\n=== 测试插件模块功能 ===')
  
  const pluginLoader = new PluginLoader()
  pluginLoader.disableSandbox()
  
  const pluginDir = join(__dirname, '../../test-plugin-source/entity-stats-plugin')
  const manifestPath = join(pluginDir, 'plugin.json')
  
  try {
    // 1. 解析插件清单
    console.log('1. 解析插件清单...')
    const manifest = await pluginLoader.parseManifest(manifestPath)
    console.log(`   插件清单解析成功: ${manifest.id} v${manifest.version}`)
    
    // 2. 验证清单内容
    console.log('2. 验证清单内容...')
    const expectedPermissions = ['entities:read', 'config:read', 'config:write', 'ui:show', 'events:subscribe']
    if (!manifest.permissions || manifest.permissions.length !== expectedPermissions.length) {
      throw new Error(`权限数量不匹配: 期望 ${expectedPermissions.length}, 实际 ${manifest.permissions?.length || 0}`)
    }
    
    for (const perm of expectedPermissions) {
      if (!manifest.permissions.includes(perm)) {
        throw new Error(`缺少权限: ${perm}`)
      }
    }
    console.log(`   权限验证通过`)
    
    // 3. 加载插件模块
    console.log('3. 加载插件模块...')
    const module = await pluginLoader.loadPluginModule(pluginDir, manifest)
    console.log(`   插件模块加载成功，导出类型: ${typeof module}`)
    
    // 4. 检查导出结构
    console.log('4. 检查导出结构...')
    if (typeof module !== 'object') {
      throw new Error('插件模块必须导出对象')
    }
    
    if (typeof module.activate !== 'function') {
      throw new Error('插件模块缺少activate函数')
    }
    
    if (typeof module.deactivate !== 'function') {
      throw new Error('插件模块缺少deactivate函数')
    }
    
    console.log(`   插件模块包含必需的activate和deactivate函数`)
    
    // 5. 测试getPluginInfo函数（可选）
    if (typeof module.getPluginInfo === 'function') {
      console.log('5. 测试getPluginInfo函数...')
      const pluginInfo = module.getPluginInfo()
      console.log(`   插件信息: ${JSON.stringify(pluginInfo)}`)
    } else {
      console.log('5. getPluginInfo函数不存在（可选）')
    }
    
  // 6. 创建模拟上下文
  console.log('6. 创建模拟上下文测试...')
  const mockContext: any = {
    pluginId: manifest.id,
    pluginVersion: manifest.version,
    logger: {
      info: (msg: string, ...args: any[]) => console.log(`[${manifest.id}] INFO: ${msg}`, ...args),
      warn: (msg: string, ...args: any[]) => console.log(`[${manifest.id}] WARN: ${msg}`, ...args),
      error: (msg: string, ...args: any[]) => console.log(`[${manifest.id}] ERROR: ${msg}`, ...args),
      debug: (msg: string, ...args: any[]) => console.log(`[${manifest.id}] DEBUG: ${msg}`, ...args)
    },
    storage: {
      get: async (key: string) => {
        console.log(`[存储] get: ${key}`)
        return null
      },
      set: async (key: string, value: any) => {
        console.log(`[存储] set: ${key} =`, value)
      },
      delete: async (key: string) => {
        console.log(`[存储] delete: ${key}`)
      },
      clear: async () => {
        console.log(`[存储] clear`)
      },
      keys: async () => {
        console.log(`[存储] keys`)
        return []
      }
    },
    config: {
      get: async (key: string, defaultValue?: any) => {
        console.log(`[配置] get: ${key}, 默认值:`, defaultValue)
        return defaultValue
      },
      set: async (key: string, value: any) => {
        console.log(`[配置] set: ${key} =`, value)
      },
      delete: async (key: string) => {
        console.log(`[配置] delete: ${key}`)
      }
    },
    entities: {
      getEntities: async () => {
        console.log(`[实体] getEntities`)
        return [
          { _id: 'test-1', _type: 'task', name: '测试任务1', createdAt: Date.now() },
          { _id: 'test-2', _type: 'task', name: '测试任务2', createdAt: Date.now() - 86400000 },
          { _id: 'test-3', _type: 'note', name: '测试笔记1', createdAt: Date.now() - 172800000 }
        ]
      },
      getTypes: async () => {
        console.log(`[实体] getTypes`)
        return [
          { id: 'task', name: '任务' },
          { id: 'note', name: '笔记' }
        ]
      },
      getEntity: async (id: string) => {
        console.log(`[实体] getEntity: ${id}`)
        return { _id: id, name: '测试实体' }
      },
      createEntity: async (entity: any) => {
        console.log(`[实体] createEntity:`, entity)
        return { ...entity, _id: `new-${Date.now()}` }
      },
      updateEntity: async (id: string, updates: any) => {
        console.log(`[实体] updateEntity: ${id}`, updates)
        return { _id: id, ...updates }
      },
      deleteEntity: async (id: string) => {
        console.log(`[实体] deleteEntity: ${id}`)
        return true
      }
    },
    ui: {
      showNotification: async (options: any) => {
        console.log(`[UI] showNotification:`, options)
      },
      showDialog: async (options: any) => {
        console.log(`[UI] showDialog:`, options)
        return { response: 0 }
      },
      openExternal: async (url: string) => {
        console.log(`[UI] openExternal: ${url}`)
      }
    },
    utils: {
      generateId: () => `test-id-${Date.now()}`,
      formatDate: (date: Date, format?: string) => {
        const formatted = date.toISOString()
        console.log(`[工具] formatDate: ${date} -> ${formatted} (格式: ${format})`)
        return formatted
      },
      deepClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
      debounce: (func: Function, wait: number) => func,
      throttle: (func: Function, wait: number) => func
    },
    events: {
      on: (event: string, listener: Function) => {
        console.log(`[事件] on: ${event}`)
      },
      once: (event: string, listener: Function) => {
        console.log(`[事件] once: ${event}`)
      },
      off: (event: string, listener: Function) => {
        console.log(`[事件] off: ${event}`)
      },
      emit: (event: string, data?: any) => {
        console.log(`[事件] emit: ${event}`, data)
      }
    },
    installPath: pluginDir,
    isActive: false,
    hasPermission: (permission: string) => {
      console.log(`[权限] hasPermission: ${permission}`)
      return true
    }
  }
    
    // 7. 调用activate
    console.log('7. 调用activate函数...')
    module.activate(mockContext)
    console.log(`   activate调用成功`)
    
    // 8. 测试命令处理器
    console.log('8. 测试命令处理器...')
    if (mockContext.commandHandlers) {
      const commands = mockContext.commandHandlers
      console.log(`   找到命令处理器: ${Object.keys(commands).join(', ')}`)
      
      // 如果有命令处理器，测试调用
      if (commands['entity-stats.show-stats']) {
        commands['entity-stats.show-stats']()
        console.log(`   命令调用成功`)
      }
    } else {
      console.log(`   未找到命令处理器（可能是激活过程中设置的）`)
    }
    
    // 9. 调用deactivate
    console.log('9. 调用deactivate函数...')
    module.deactivate()
    console.log(`   deactivate调用成功`)
    
    console.log('✅ 插件模块功能测试通过')
    
    return {
      success: true,
      message: '插件模块功能测试通过'
    }
    
  } catch (error) {
    console.error('❌ 插件模块功能测试失败:', error)
    return {
      success: false,
      message: `插件模块功能测试失败: ${(error as Error).message}`,
      error: (error as Error).stack
    }
  }
}

// 运行测试
async function runAllTests() {
  console.log('开始运行实体统计插件测试套件...\n')
  
  const results: TestSuiteResult[] = []
  
  // 运行生命周期测试
  const lifecycleResult = await testEntityStatsPlugin()
  results.push({
    name: '插件生命周期测试',
    result: lifecycleResult
  })
  
  // 运行模块功能测试
  const moduleResult = await testPluginModuleFunctionality()
  results.push({
    name: '插件模块功能测试',
    result: moduleResult
  })
  
  // 输出总结
  console.log('\n=== 测试总结 ===')
  let passed = 0
  let failed = 0
  
  results.forEach((test, index) => {
    if (test.result.success) {
      console.log(`✅ ${index + 1}. ${test.name}: 通过`)
      passed++
    } else {
      console.log(`❌ ${index + 1}. ${test.name}: 失败`)
      console.log(`   错误: ${test.result.message}`)
      if (test.result.error) {
        console.log(`   堆栈: ${test.result.error}`)
      }
      failed++
    }
  })
  
  console.log(`\n总计: ${results.length} 个测试, ${passed} 通过, ${failed} 失败`)
  
  if (failed > 0) {
    console.error('❌ 测试套件失败')
    process.exit(1)
  } else {
    console.log('✅ 所有测试通过')
    process.exit(0)
  }
}

// 如果是直接运行此文件，则执行测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('测试运行失败:', error)
    process.exit(1)
  })
}

// 导出测试函数以便其他测试使用
export {
  testEntityStatsPlugin,
  testPluginModuleFunctionality,
  runAllTests
}