interface ElectronAPI {
  getVersion: () => Promise<string>;
  installUpdate: () => Promise<void>;
  getEnvFilePath: () => Promise<string>;
  onUpdateAvailable: (callback: (data: { version: string }) => void) => void;
  onUpdateDownloaded: (callback: (data: { version: string }) => void) => void;
  onUpdateProgress: (callback: (data: { percent: number }) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
