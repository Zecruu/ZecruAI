"use client";

import { ReactNode } from "react";
import FileExplorer from "./FileExplorer";
import TerminalPanel from "./TerminalPanel";
import { FileEntry, BrowseFilesResult, CommandOutput } from "@/types/robot";

interface RobotLayoutProps {
  children: ReactNode;
  // File explorer
  fileExplorerOpen: boolean;
  rootPath: string;
  fileEntries: FileEntry[];
  fileLoading: boolean;
  onBrowse: (path: string) => Promise<BrowseFilesResult>;
  onRefreshFiles: () => void;
  // Terminal
  terminalOpen: boolean;
  workingDir: string;
  commands: CommandOutput[];
  onRunCommand: (command: string) => void;
  onCloseTerminal: () => void;
}

export default function RobotLayout({
  children,
  fileExplorerOpen,
  rootPath,
  fileEntries,
  fileLoading,
  onBrowse,
  onRefreshFiles,
  terminalOpen,
  workingDir,
  commands,
  onRunCommand,
  onCloseTerminal,
}: RobotLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* File Explorer Panel */}
      {fileExplorerOpen && (
        <div className="w-60 shrink-0 h-full hidden md:block">
          <FileExplorer
            rootPath={rootPath}
            entries={fileEntries}
            onBrowse={onBrowse}
            onRefresh={onRefreshFiles}
            loading={fileLoading}
          />
        </div>
      )}

      {/* Chat Area (center) */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {children}
      </div>

      {/* Terminal Panel */}
      {terminalOpen && (
        <div className="w-80 shrink-0 h-full hidden md:block">
          <TerminalPanel
            workingDir={workingDir}
            commands={commands}
            onRunCommand={onRunCommand}
            onClose={onCloseTerminal}
          />
        </div>
      )}
    </div>
  );
}
