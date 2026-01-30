<template>
  <div class="error-boundary">
    <div v-if="hasError" class="error-fallback">
      <div class="error-content">
        <el-icon class="error-icon" size="48" color="var(--el-color-danger)">
          <WarningFilled />
        </el-icon>
        <h3>出现了一些问题</h3>
        <p class="error-message">{{ errorMessage }}</p>
        <div class="error-actions">
          <el-button type="primary" @click="retryAction">
            <el-icon><Refresh /></el-icon>
            重试
          </el-button>
          <el-button @click="reportErrorAction">
            <el-icon><Document /></el-icon>
            报告问题
          </el-button>
        </div>
        <details class="error-details" v-if="errorDetails">
          <summary>技术详情</summary>
          <pre>{{ errorDetails }}</pre>
        </details>
      </div>
    </div>

    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { WarningFilled, Refresh, Document } from '@element-plus/icons-vue'
import MessageService from '../utils/messageService'

interface Props {
  fallback?: () => void
  onError?: (error: Error, errorInfo: any) => void
}

interface Emits {
  (e: 'error', error: Error, errorInfo: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const hasError = ref(false)
const errorMessage = ref('')
const errorDetails = ref('')

// 捕获组件树中的错误
onErrorCaptured((err: any, instance: any, info: any) => {
  const error = err instanceof Error ? err : new Error(String(err))
  console.error('ErrorBoundary captured an error:', error, info)

  hasError.value = true
  errorMessage.value = error.message || '未知错误'
  errorDetails.value = JSON.stringify(
    {
      message: error.message,
      stack: error.stack,
      component: info,
      timestamp: new Date().toISOString()
    },
    null,
    2
  )

  // 调用错误回调
  if (props.onError) {
    props.onError(error, info)
  }

  emit('error', error, info)
})

// 重试功能
const retryAction = () => {
  hasError.value = false
  errorMessage.value = ''
  errorDetails.value = ''

  // 刷新页面或重新渲染组件
  window.location.reload()
}

// 报告错误
const reportErrorAction = () => {
  const errorReport = {
    message: errorMessage.value,
    details: errorDetails.value,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString()
  }

  // 这里可以发送错误报告到服务器
  console.log('Error report:', errorReport)

  MessageService.info('错误报告已记录，感谢您的反馈')
}

// 处理未捕获的Promise错误
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error('Unhandled promise rejection:', event.reason)

  hasError.value = true
  errorMessage.value = event.reason?.message || '异步操作失败'
  errorDetails.value = JSON.stringify(
    {
      reason: event.reason,
      type: 'unhandledPromiseRejection',
      timestamp: new Date().toISOString()
    },
    null,
    2
  )

  MessageService.error('异步操作出现错误')
}

// 处理全局错误
const handleGlobalError = (event: ErrorEvent) => {
  console.error('Global error:', event)
  if (event.message === 'ResizeObserver loop completed with undelivered notifications.') return

  hasError.value = true
  errorMessage.value = event.error?.message || '页面出现错误'
  errorDetails.value = JSON.stringify(
    {
      message: event.error?.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: 'globalError',
      timestamp: new Date().toISOString()
    },
    null,
    2
  )

  MessageService.error('页面出现错误')
}

// 监听未处理的Promise拒绝
window.addEventListener('unhandledrejection', handleUnhandledRejection)

// 监听全局错误
window.addEventListener('error', handleGlobalError)

// 清理全局错误监听器
onUnmounted(() => {
  window.removeEventListener('error', handleGlobalError)
  window.removeEventListener('unhandledrejection', handleUnhandledRejection)
})

// 监听全局错误
window.addEventListener('error', handleGlobalError)

// 清理全局错误监听器
onUnmounted(() => {
  window.removeEventListener('error', handleGlobalError)
  window.removeEventListener('unhandledrejection', handleUnhandledRejection)
})
</script>

<style scoped lang="scss">
.error-boundary {
  height: 100%;
  width: 100%;
}

.error-fallback {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  margin: 16px;
}

.error-content {
  max-width: 500px;
  text-align: center;

  .error-icon {
    margin-bottom: 16px;
  }

  h3 {
    margin: 0 0 16px 0;
    color: var(--el-text-color-primary);
    font-size: 20px;
  }

  .error-message {
    margin: 0 0 24px 0;
    color: var(--el-text-color-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .error-details {
    margin-top: 16px;
    text-align: left;

    summary {
      cursor: pointer;
      color: var(--el-color-primary);
      font-weight: 500;
      padding: 8px;
      border: 1px solid var(--el-border-color);
      border-radius: 4px;
      background-color: var(--el-bg-color);

      &:hover {
        background-color: var(--el-bg-color-page);
      }
    }

    pre {
      margin-top: 12px;
      padding: 12px;
      background-color: var(--el-bg-color);
      border: 1px solid var(--el-border-color);
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.4;
      overflow-x: auto;
      color: var(--el-text-color-secondary);
    }
  }
}
</style>
