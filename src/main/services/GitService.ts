import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { SystemService } from './SystemService'

/**
 * Git服务，处理git仓库的克隆、更新检查、拉取等操作
 */
export class GitService {
  private git: SimpleGit
  private gitAvailable: boolean = false

  constructor() {
    const options: Partial<SimpleGitOptions> = {
      binary: 'git',
      maxConcurrentProcesses: 1,
      trimmed: true
    }
    this.git = simpleGit(options)
    this.checkGitAvailability()
  }

  /**
   * 检查git是否可用
   */
  async checkGitAvailability(): Promise<boolean> {
    try {
      await this.git.version()
      this.gitAvailable = true
      return true
    } catch (error) {
      this.gitAvailable = false
      await SystemService.logWarn(
        `Git不可用: ${error instanceof Error ? error.message : String(error)}`,
        'GitService.checkGitAvailability'
      )
      return false
    }
  }

  /**
   * 检查git是否可用并返回详细状态
   */
  async getGitStatus(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const version = await this.git.version()
      this.gitAvailable = true
      return { available: true, version: version.toString() }
    } catch (error) {
      this.gitAvailable = false
      await SystemService.logWarn(
        `Git不可用: ${error instanceof Error ? error.message : String(error)}`,
        'GitService.getGitStatus'
      )
      return {
        available: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 克隆git仓库到临时目录
   * @param url git仓库URL
   * @param options 选项
   * @returns 临时目录路径和提交哈希
   */
  async cloneRepository(
    url: string,
    options?: {
      branch?: string
      depth?: number
      tempDir?: string
    }
  ): Promise<{ path: string; commit: string }> {
    if (!this.gitAvailable) {
      throw new Error('Git未安装或不在PATH中。请安装Git后重试。')
    }

    const tempDir = options?.tempDir || (await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-git-')))

    try {
      const cloneOptions: string[] = []
      if (options?.depth) {
        cloneOptions.push(`--depth=${options.depth}`)
      } else {
        // 默认浅克隆
        cloneOptions.push('--depth=1')
      }

      if (options?.branch) {
        cloneOptions.push(`--branch=${options.branch}`)
      }

      await this.git.clone(url, tempDir, cloneOptions)

      // 获取最新提交
      const commit = await this.git.cwd(tempDir).revparse(['HEAD'])
      return { path: tempDir, commit: commit.trim() }
    } catch (error) {
      // 清理临时目录
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      await SystemService.logError(error, 'GitService.cloneRepository')
      throw new Error(`克隆仓库失败: ${(error as Error).message}`)
    }
  }

  /**
   * 检查仓库是否有更新
   * @param repoPath 仓库路径
   * @returns 更新信息
   */
  async checkForUpdates(repoPath: string): Promise<{
    hasUpdates: boolean
    localCommit: string
    remoteCommit?: string
    ahead: number
    behind: number
    branch?: string
  }> {
    if (!this.gitAvailable) {
      throw new Error('Git不可用')
    }

    try {
      // 先获取当前分支信息
      const status = await this.git.cwd(repoPath).status()
      const branch = status.current

      if (!branch) {
        throw new Error('无法获取当前分支')
      }

      // 获取远程更新
      await this.git.cwd(repoPath).fetch()
      const updatedStatus = await this.git.cwd(repoPath).status()

      // 尝试获取远程提交
      let remoteCommit = ''
      try {
        remoteCommit = (await this.git.cwd(repoPath).revparse([`origin/${branch}`])).trim()
      } catch {
        // 忽略错误
      }

      return {
        hasUpdates: updatedStatus.behind > 0,
        localCommit: updatedStatus.current || '',
        remoteCommit: remoteCommit || undefined,
        ahead: updatedStatus.ahead,
        behind: updatedStatus.behind,
        branch
      }
    } catch (error) {
      await SystemService.logError(error, 'GitService.checkForUpdates')
      throw new Error(`检查更新失败: ${(error as Error).message}`)
    }
  }

  /**
   * 拉取仓库更新
   * @param repoPath 仓库路径
   * @returns 拉取结果
   */
  async pullUpdates(
    repoPath: string
  ): Promise<{ success: boolean; changes: string[]; message?: string }> {
    if (!this.gitAvailable) {
      throw new Error('Git不可用')
    }

    try {
      // 检查当前状态
      const beforeCommit = await this.git.cwd(repoPath).revparse(['HEAD'])

      // 拉取更新
      const pullResult = await this.git.cwd(repoPath).pull()

      const afterCommit = await this.git.cwd(repoPath).revparse(['HEAD'])
      const hasChanges = beforeCommit.trim() !== afterCommit.trim()

      const changes: string[] = []
      if (hasChanges) {
        changes.push(`从 ${beforeCommit.substring(0, 8)} 更新到 ${afterCommit.substring(0, 8)}`)

        // 尝试获取提交信息
        try {
          const log = await this.git
            .cwd(repoPath)
            .log({ from: beforeCommit.trim(), to: afterCommit.trim() })
          if (log.total > 0) {
            changes.push(...log.all.map((commit) => `• ${commit.message.split('\n')[0]}`))
          }
        } catch {
          // 忽略获取日志错误
        }
      }

      return {
        success: true,
        changes,
        message: pullResult.summary.changes ? '更新成功' : '已是最新版本'
      }
    } catch (error) {
      await SystemService.logError(error, 'GitService.pullUpdates')
      return {
        success: false,
        changes: [],
        message: `拉取更新失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 获取仓库信息
   * @param repoPath 仓库路径
   * @returns 仓库信息
   */
  async getRepositoryInfo(repoPath: string): Promise<{
    url?: string
    branch?: string
    commit?: string
    hasChanges: boolean
  }> {
    if (!this.gitAvailable) {
      throw new Error('Git不可用')
    }

    try {
      const [remotes, status, commit] = await Promise.all([
        this.git.cwd(repoPath).getRemotes(true),
        this.git.cwd(repoPath).status(),
        this.git
          .cwd(repoPath)
          .revparse(['HEAD'])
          .catch(() => '')
      ])

      const origin = remotes.find((r) => r.name === 'origin')

      return {
        url: origin?.refs.fetch,
        branch: status.current || undefined,
        commit: commit.trim(),
        hasChanges: status.files.length > 0
      }
    } catch (error) {
      await SystemService.logError(error, 'GitService.getRepositoryInfo')
      throw new Error(`获取仓库信息失败: ${(error as Error).message}`)
    }
  }

  /**
   * 清理临时目录
   * @param tempPath 临时目录路径
   */
  async cleanupTempDirectory(tempPath: string): Promise<void> {
    try {
      await fs.rm(tempPath, { recursive: true, force: true })
    } catch (error) {
      console.warn(`清理临时目录失败: ${tempPath}`, error)
      await SystemService.logWarn(
        `清理临时目录失败: ${tempPath}`,
        'GitService.cleanupTempDirectory',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }
  }

  /**
   * 验证git URL格式
   * @param url git URL
   * @returns 是否为有效的git URL
   */
  isValidGitUrl(url: string): boolean {
    const trimmed = url.trim()
    return /^(https?:\/\/|git@|git:\/\/|ssh:\/\/)/.test(trimmed)
  }

  /**
   * 检查目录是否为git仓库
   * @param dirPath 目录路径
   * @returns 是否为git仓库
   */
  async isGitRepository(dirPath: string): Promise<boolean> {
    try {
      await fs.access(path.join(dirPath, '.git'))
      return true
    } catch {
      return false
    }
  }
}
