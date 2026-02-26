"use client";

import { useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { FileEntry, BrowseFilesResult } from "@/types/robot";

interface FileExplorerProps {
  rootPath: string;
  entries: FileEntry[];
  onBrowse: (path: string) => Promise<BrowseFilesResult>;
  onRefresh: () => void;
  loading?: boolean;
}

function getFileIcon(entry: FileEntry) {
  if (entry.type === "directory") return null; // handled by expand state
  const ext = entry.extension?.toLowerCase();
  switch (ext) {
    case ".ts":
    case ".tsx":
    case ".js":
    case ".jsx":
    case ".py":
    case ".rs":
    case ".go":
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    case ".json":
      return <FileJson className="w-4 h-4 text-yellow-400 shrink-0" />;
    case ".md":
    case ".txt":
    case ".yml":
    case ".yaml":
    case ".toml":
      return <FileText className="w-4 h-4 text-gray-400 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-gray-500 shrink-0" />;
  }
}

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  onBrowse: (path: string) => Promise<BrowseFilesResult>;
}

function TreeNode({ entry, depth, onBrowse }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (entry.type !== "directory") return;

    if (expanded) {
      setExpanded(false);
      return;
    }

    if (children.length === 0) {
      setLoading(true);
      try {
        const result = await onBrowse(entry.path);
        setChildren(result.entries);
      } catch {
        setChildren([]);
      }
      setLoading(false);
    }

    setExpanded(true);
  }, [entry, expanded, children.length, onBrowse]);

  const isDir = entry.type === "directory";

  return (
    <div>
      <button
        onClick={handleToggle}
        className={`w-full flex items-center gap-1.5 py-1 px-2 text-left text-sm hover:bg-surface/80 transition-colors rounded ${
          isDir ? "cursor-pointer" : "cursor-default"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          <>
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
            ) : expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            {expanded ? (
              <FolderOpen className="w-4 h-4 text-accent shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-accent shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            {getFileIcon(entry)}
          </>
        )}
        <span className="truncate text-foreground/90">{entry.name}</span>
        {!isDir && entry.size !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground shrink-0">
            {entry.size > 1024 ? `${(entry.size / 1024).toFixed(0)}KB` : `${entry.size}B`}
          </span>
        )}
      </button>

      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} onBrowse={onBrowse} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer({ rootPath, entries, onBrowse, onRefresh, loading }: FileExplorerProps) {
  const folderName = rootPath.replace(/\\/g, "/").split("/").pop() || rootPath;

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </h3>
        <button
          onClick={onRefresh}
          className="p-1 hover:bg-surface rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-2 py-1.5 border-b border-border/50">
        <span className="text-xs font-medium text-foreground/80 truncate block">{folderName}</span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No files found
          </div>
        ) : (
          entries.map((entry) => (
            <TreeNode key={entry.path} entry={entry} depth={0} onBrowse={onBrowse} />
          ))
        )}
      </div>
    </div>
  );
}
