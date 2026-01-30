import { ElectronAPI } from '@electron-toolkit/preload'
import { EntityManagerAPI } from '../shared/types/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: EntityManagerAPI
  }
}
