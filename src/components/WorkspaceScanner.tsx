"use client";

import { useState } from "react";
import { ScannedProject } from "@/types/robot";
import { Search, Loader2, FolderGit2, Plus } from "lucide-react";

interface WorkspaceScannerProps {
  scannedProjects: ScannedProject[];
  scanning: boolean;
  onScan: () => void;
  onAddProject: (name: string, path: string) => void;
  addedPaths: Set<string>;
}

export default function WorkspaceScanner({
  scannedProjects,
  scanning,
  onScan,
  onAddProject,
  addedPaths,
}: WorkspaceScannerProps) {
  return (
    <div className="px-4 py-2 space-y-2">
      {/* Scan Button */}
      <button
        onClick={onScan}
        disabled={scanning}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-50 transition-colors"
      >
        {scanning ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Search size={14} />
        )}
        {scanning ? "Scanning..." : "Scan for Projects"}
      </button>

      {/* Scanned Results */}
      {scannedProjects.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold px-1">
            Discovered ({scannedProjects.length})
          </p>
          {scannedProjects.map((project) => {
            const isAdded = addedPaths.has(project.path);

            return (
              <div
                key={project.path}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface transition-colors"
              >
                <FolderGit2 size={14} className="text-accent/70 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {project.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {project.framework && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                        {project.framework}
                      </span>
                    )}
                    {project.indicators.slice(0, 2).map((ind) => (
                      <span
                        key={ind}
                        className="text-[9px] px-1 py-0.5 rounded bg-surface text-muted"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>
                {isAdded ? (
                  <span className="text-[10px] text-success font-medium">Added</span>
                ) : (
                  <button
                    onClick={() => onAddProject(project.name, project.path)}
                    className="p-1 rounded hover:bg-accent/10 text-accent transition-colors"
                    title="Add to projects"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
