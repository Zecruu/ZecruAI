export interface ScannedProject {
  name: string;
  path: string;
  indicators: string[];
  language?: string;
  framework?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  modified?: number;
  extension?: string;
  children?: FileEntry[];
}

export interface CommandOutput {
  id: string;
  command: string;
  workingDir: string;
  chunks: Array<{
    data: string;
    stream: "stdout" | "stderr";
    timestamp: number;
  }>;
  exitCode: number | null;
  durationMs?: number;
  running: boolean;
}

export interface RobotDaemonStatus {
  running: boolean;
  pid: number | null;
  mode: "robot";
  connectedSince?: number;
}

export interface WorkspaceScanResult {
  projects: ScannedProject[];
  rootPath: string;
  scannedAt: number;
}

export interface BrowseFilesResult {
  path: string;
  entries: FileEntry[];
}
