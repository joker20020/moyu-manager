import { ElMessage, ElMessageBox } from 'element-plus'

export type MessageType = 'success' | 'error' | 'warning' | 'info'
export type MessageOptions = {
  duration?: number
  showClose?: boolean
  center?: boolean
  onClose?: () => void
}

export type MessageBoxOptions = {
  type?: 'alert' | 'confirm' | 'prompt'
  title?: string
  message?: string
  confirmButtonText?: string
  cancelButtonText?: string
  dangerouslyUseHTMLString?: boolean
  beforeClose?: (action: string, instance: any, done: () => void) => void
}

class MessageService {
  // 成功消息
  static success(message: string, options?: MessageOptions) {
    return ElMessage.success({
      message,
      duration: 3000,
      showClose: true,
      ...options
    })
  }

  // 错误消息
  static error(message: string, options?: MessageOptions) {
    return ElMessage.error({
      message,
      duration: 5000,
      showClose: true,
      ...options
    })
  }

  // 警告消息
  static warning(message: string, options?: MessageOptions) {
    return ElMessage.warning({
      message,
      duration: 4000,
      showClose: true,
      ...options
    })
  }

  // 信息消息
  static info(message: string, options?: MessageOptions) {
    return ElMessage.info({
      message,
      duration: 3000,
      showClose: true,
      ...options
    })
  }

  // 加载消息
  static loading(message: string = '加载中...', options?: MessageOptions) {
    return ElMessage.info({
      message,
      duration: 0, // 不自动关闭
      showClose: false,
      ...options
    })
  }

  // 关闭所有消息
  static closeAll() {
    ElMessage.closeAll()
  }

  // 确认对话框
  static async confirm(
    message: string,
    title: string = '确认',
    options?: Partial<
      Omit<
        import('element-plus').ElMessageBoxOptions,
        'confirmButtonText' | 'cancelButtonText' | 'type'
      >
    >
  ): Promise<boolean> {
    try {
      await ElMessageBox.confirm(message, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        ...options
      })
      return true
    } catch {
      return false
    }
  }

  // 提示对话框
  static async alert(
    message: string,
    title: string = '提示',
    options?: Partial<import('element-plus').ElMessageBoxOptions>
  ): Promise<void> {
    await ElMessageBox.alert(message, title, {
      confirmButtonText: '确定',
      ...options
    })
  }

  // 输入对话框
  static async prompt(
    message: string,
    title: string = '输入',
    options?: Partial<
      Omit<import('element-plus').ElMessageBoxOptions, 'confirmButtonText' | 'cancelButtonText'>
    >
  ): Promise<string | null> {
    try {
      const { value } = await ElMessageBox.prompt(message, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        ...options
      })
      return value
    } catch {
      return null
    }
  }

  // 操作结果处理
  static handleOperationResult<T>(
    result: { success: boolean; data?: T; error?: string },
    successMessage?: string,
    errorMessage?: string
  ): T | null {
    if (result.success) {
      if (successMessage) {
        this.success(successMessage)
      }
      return result.data || null
    } else {
      this.error(errorMessage || result.error || '操作失败')
      return null
    }
  }

  // 异步操作包装器
  static async wrapAsyncOperation<T>(
    operation: () => Promise<T>,
    options: {
      loadingMessage?: string
      successMessage?: string
      errorMessage?: string
      showSuccess?: boolean
      showError?: boolean
    } = {}
  ): Promise<T | null> {
    const {
      loadingMessage = '处理中...',
      successMessage,
      errorMessage,
      showSuccess = true,
      showError = true
    } = options

    let loadingInstance: any = null

    try {
      if (loadingMessage) {
        loadingInstance = this.loading(loadingMessage)
      }

      const result = await operation()

      if (showSuccess && successMessage) {
        this.success(successMessage)
      }

      return result
    } catch (error: any) {
      if (showError) {
        this.error(errorMessage || error.message || '操作失败')
      }
      console.error('Async operation failed:', error)
      return null
    } finally {
      if (loadingInstance) {
        loadingInstance.close()
      }
    }
  }

  // 批量操作结果处理
  static handleBatchResult(
    results: Array<{ success: boolean; error?: string }>,
    successMessage?: string,
    errorMessage?: string
  ) {
    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    if (failCount === 0) {
      this.success(successMessage || '所有操作成功')
    } else if (successCount === 0) {
      this.error(errorMessage || '所有操作失败')
    } else {
      this.warning(`成功 ${successCount} 项，失败 ${failCount} 项`)
    }
  }

  // 网络错误处理
  static handleNetworkError(error: any): void {
    console.error('Network error:', error)

    if (error.code === 'NETWORK_ERROR') {
      this.error('网络连接失败，请检查网络设置')
    } else if (error.code === 'TIMEOUT') {
      this.error('请求超时，请稍后重试')
    } else if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 400:
          this.error(data?.message || '请求参数错误')
          break
        case 401:
          this.error('未授权访问')
          break
        case 403:
          this.error('访问被拒绝')
          break
        case 404:
          this.error('请求的资源不存在')
          break
        case 500:
          this.error('服务器内部错误')
          break
        default:
          this.error(`请求失败 (${status})`)
      }
    } else {
      this.error(error.message || '未知错误')
    }
  }
}

export default MessageService
