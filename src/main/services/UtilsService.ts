import {
  app,
  shell,
  dialog,
  MessageBoxOptions,
  OpenDialogOptions,
  SaveDialogOptions
} from 'electron'

export class UtilsService {
  async ping(): Promise<string> {
    return 'pong'
  }

  async getVersion(): Promise<string> {
    return app.getVersion()
  }

  async openExternal(url: string): Promise<void> {
    await shell.openExternal(url)
  }

  async showMessageBox(options: MessageBoxOptions): Promise<any> {
    return dialog.showMessageBox(options)
  }

  async showOpenDialog(options: OpenDialogOptions): Promise<any> {
    return dialog.showOpenDialog(options)
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<any> {
    return dialog.showSaveDialog(options)
  }
}
