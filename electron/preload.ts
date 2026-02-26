import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke("app:get-version"),

  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke("app:install-update"),

  getEnvFilePath: (): Promise<string> =>
    ipcRenderer.invoke("app:get-env-file-path"),

  onUpdateAvailable: (callback: (data: { version: string }) => void) => {
    ipcRenderer.on("update-available", (_event, data) => callback(data));
  },

  onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
    ipcRenderer.on("update-downloaded", (_event, data) => callback(data));
  },

  onUpdateProgress: (callback: (data: { percent: number }) => void) => {
    ipcRenderer.on("update-progress", (_event, data) => callback(data));
  },
});
