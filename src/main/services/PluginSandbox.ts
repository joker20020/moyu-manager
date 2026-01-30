import * as vm from 'vm'
import * as fs from 'fs/promises'
import * as path from 'path'
import { SystemService } from './SystemService'

/**
 * 插件沙箱错误类型
 */
export class PluginSandboxError extends Error {
  constructor(
    message: string,
    public readonly pluginId?: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'PluginSandboxError'
  }
}

/**
 * 插件沙箱 - 使用Node.js vm模块隔离插件代码执行
 * 注意：vm模块不是完全安全的，但对于基本的插件隔离足够
 * 对于更高安全要求，应考虑其他方案（如Worker线程、子进程）
 */
export class PluginSandbox {
  // 允许的全局对象白名单
  private readonly allowedGlobals: Set<string> = new Set([
    // JavaScript标准全局对象
    'Array',
    'Boolean',
    'Date',
    'Error',
    'EvalError',
    'Function',
    'Infinity',
    'JSON',
    'Math',
    'NaN',
    'Number',
    'Object',
    'RangeError',
    'ReferenceError',
    'RegExp',
    'String',
    'SyntaxError',
    'TypeError',
    'URIError',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',
    'isFinite',
    'isNaN',
    'parseFloat',
    'parseInt',
    // 控制台（限制版本）
    'console',
    // 定时器（限制版本）
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    // 微任务
    'Promise',
    'queueMicrotask',
    // 其他
    'Buffer',
    'URL',
    'URLSearchParams',
    'TextEncoder',
    'TextDecoder'
  ])

  // 禁止的模块列表
  private readonly forbiddenModules: Set<string> = new Set([
    'child_process',
    'cluster',
    'crypto', // 可能允许但需要特殊处理
    'dns',
    'fs',
    'http',
    'https',
    'net',
    'os',
    'path',
    'process',
    'querystring',
    'stream',
    'tls',
    'vm',
    'zlib',
    'electron'
  ])

  // 插件上下文缓存
  private contexts: Map<string, vm.Context> = new Map()

  constructor() {
    SystemService.logInfo('PluginSandbox initialized', 'PluginSandbox').catch(() => {})
  }

  /**
   * 创建隔离的VM上下文
   */
  createContext(pluginId: string, contextAPI: Record<string, any>): vm.Context {
    // 创建基础全局对象
    const sandbox: any = {}

    // 添加允许的全局对象
    for (const globalName of Array.from(this.allowedGlobals)) {
      if (globalName in global) {
        sandbox[globalName] = (global as any)[globalName]
      }
    }

    // 添加限制的控制台（只允许特定方法）
    sandbox.console = this.createRestrictedConsole()

    // 添加限制的定时器
    sandbox.setTimeout = (handler: TimerHandler, timeout?: number, ...args: any[]) => {
      return setTimeout(handler, Math.min(timeout || 0, 5000), ...args) // 限制最大5秒
    }
    sandbox.clearTimeout = clearTimeout
    sandbox.setInterval = (handler: TimerHandler, timeout?: number, ...args: any[]) => {
      return setInterval(handler, Math.min(timeout || 0, 5000), ...args) // 限制最大5秒
    }
    sandbox.clearInterval = clearInterval

    // 添加插件API
    Object.assign(sandbox, contextAPI)

    // 创建VM上下文
    const vmContext = vm.createContext(sandbox, {
      name: `plugin:${pluginId}`,
      codeGeneration: {
        strings: true,
        wasm: false // 禁用WebAssembly以提高安全性
      }
    })

    // 缓存上下文
    this.contexts.set(pluginId, vmContext)

    return vmContext
  }

  /**
   * 创建受限制的控制台对象
   */
  private createRestrictedConsole(): Console {
    const originalConsole = console

    // 创建代理，允许所有控制台方法但可以添加限制
    return new Proxy(originalConsole, {
      get(target, prop) {
        // 只允许标准的console方法
        if (
          typeof prop === 'string' &&
          ['log', 'info', 'warn', 'error', 'debug', 'table', 'time', 'timeEnd', 'trace'].includes(
            prop
          )
        ) {
          return (target as any)[prop]
        }
        return () => {} // 不允许的方法返回空函数
      }
    })
  }

  /**
   * 在沙箱中执行代码
   */
  executeCode<T = any>(pluginId: string, code: string, filename?: string): T {
    const context = this.contexts.get(pluginId)
    if (!context) {
      throw new PluginSandboxError(`插件 ${pluginId} 的上下文不存在`, pluginId)
    }

    try {
      const script = new vm.Script(code, {
        filename: filename || `<plugin:${pluginId}>`,
        lineOffset: 0,
        columnOffset: 0
      })

      return script.runInContext(context, {
        timeout: 5000 // 5秒超时
      })
    } catch (error) {
      SystemService.logError(error, 'PluginSandbox.executeCode', { pluginId }).catch(() => {})
      throw new PluginSandboxError(
        `执行代码时出错: ${(error as Error).message}`,
        pluginId,
        error as Error
      )
    }
  }

  /**
   * 在沙箱中执行模块（CommonJS风格）
   */
  executeModule(
    pluginId: string,
    moduleCode: string,
    filename: string,
    exports: any = {},
    require: (id: string) => any,
    module: { exports: any } = { exports }
  ): any {
    const context = this.contexts.get(pluginId)
    if (!context) {
      throw new PluginSandboxError(`插件 ${pluginId} 的上下文不存在`, pluginId)
    }

    // 准备模块环境
    const sandbox = {
      ...context,
      exports,
      require,
      module,
      __filename: filename,
      __dirname: path.dirname(filename)
    }

    try {
      const script = new vm.Script(
        `(function(exports, require, module, __filename, __dirname) {
 ${moduleCode}
 })(exports, require, module, __filename, __dirname)`,
        {
          filename,
          lineOffset: 1,
          columnOffset: 0
        }
      )

      script.runInContext(vm.createContext(sandbox), {
        timeout: 10000 // 10秒超时
      })

      return module.exports
    } catch (error) {
      SystemService.logError(error, 'PluginSandbox.executeModule', { pluginId }).catch(() => {})
      throw new PluginSandboxError(
        `执行模块时出错: ${(error as Error).message}`,
        pluginId,
        error as Error
      )
    }
  }

  /**
   * 创建安全的require函数
   */
  createSafeRequire(
    pluginId: string,
    allowedModules: Set<string> = new Set()
  ): (id: string) => any {
    return (id: string) => {
      // 检查是否允许该模块
      if (this.forbiddenModules.has(id) && !allowedModules.has(id)) {
        throw new PluginSandboxError(`不允许加载模块: ${id}`, pluginId)
      }

      // 对于允许的模块，返回原始require
      return require(id)
    }
  }

  /**
   * 加载插件模块到沙箱中
   */
  async loadPluginModule(
    pluginId: string,
    modulePath: string,
    contextAPI: Record<string, any>
  ): Promise<any> {
    try {
      // 读取模块代码
      const code = await fs.readFile(modulePath, 'utf-8')

      // 创建沙箱上下文
      void this.createContext(pluginId, contextAPI)

      // 创建安全的require函数
      const safeRequire = this.createSafeRequire(pluginId)

      // 执行模块
      const exports = {}
      const module = { exports }

      const result = this.executeModule(pluginId, code, modulePath, exports, safeRequire, module)

      return result
    } catch (error) {
      if (error instanceof PluginSandboxError) {
        throw error
      }
      await SystemService.logError(error, 'PluginSandbox.loadPluginModule', { pluginId })
      throw new PluginSandboxError(
        `加载插件模块失败: ${(error as Error).message}`,
        pluginId,
        error as Error
      )
    }
  }

  /**
   * 销毁插件上下文
   */
  destroyContext(pluginId: string): void {
    this.contexts.delete(pluginId)
  }

  /**
   * 清理所有上下文
   */
  destroyAllContexts(): void {
    this.contexts.clear()
  }

  /**
   * 检查模块是否被禁止
   */
  isModuleForbidden(moduleName: string): boolean {
    return this.forbiddenModules.has(moduleName)
  }

  /**
   * 添加允许的模块
   */
  allowModule(moduleName: string): void {
    this.forbiddenModules.delete(moduleName)
  }

  /**
   * 禁止模块
   */
  forbidModule(moduleName: string): void {
    this.forbiddenModules.add(moduleName)
  }
}
