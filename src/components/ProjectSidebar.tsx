"use client";

import { useState } from "react";
import { Project } from "@/types";
import { ScannedProject } from "@/types/robot";
import {
  FolderOpen,
  Plus,
  X,
  Trash2,
  Check,
} from "lucide-react";
import WorkspaceScanner from "./WorkspaceScanner";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string | null;
  connectedProjectIds: Set<string>;
  onSelect: (id: string) => void;
  onAdd: (name: string, workingDirectory: string) => void;
  onDelete: (id: string) => void;
  // Robot workspace scanning
  scannedProjects?: ScannedProject[];
  scanning?: boolean;
  onScan?: () => void;
  workspaceRoot?: string;
}

export default function ProjectSidebar({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  connectedProjectIds,
  onSelect,
  onAdd,
  onDelete,
  scannedProjects = [],
  scanning = false,
  onScan,
  workspaceRoot,
}: ProjectSidebarProps) {
  const [adding, setAdding] = useState(false);
  const [newPath, setNewPath] = useState("");

  const handleAdd = () => {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    // Extract folder name from path
    const name = trimmed.split(/[/\\]/).filter(Boolean).pop() || trimmed;
    onAdd(name, trimmed);
    setNewPath("");
    setAdding(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sidebar */}
      <div className="relative w-72 max-w-[80vw] bg-background border-r border-border h-full animate-slide-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen size={16} className="text-accent" />
            Projects
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto py-2">
          {projects.length === 0 && !adding && (
            <div className="px-4 py-8 text-center">
              <FolderOpen size={32} className="text-muted mx-auto mb-3 opacity-40" />
              <p className="text-xs text-muted">No projects yet</p>
              <p className="text-xs text-muted mt-1">Add a project to get started</p>
            </div>
          )}

          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const isConnected = connectedProjectIds.has(project.id);

            return (
              <div
                key={project.id}
                onClick={() => onSelect(project.id)}
                className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  isActive
                    ? "bg-accent/10 border-r-2 border-accent"
                    : "hover:bg-surface"
                }`}
              >
                {/* Status dot */}
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isConnected ? "bg-success" : "bg-border"
                  }`}
                />

                {/* Project info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      isActive ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {project.name}
                  </p>
                  <p className="text-[10px] text-muted truncate">
                    {project.workingDirectory}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-muted hover:text-danger transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          {/* Add project form */}
          {adding && (
            <div className="px-4 py-2">
              <input
                type="text"
                autoFocus
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewPath("");
                  }
                }}
                placeholder="C:\Users\you\projects\my-app"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted outline-none focus:border-accent/50 font-mono"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAdd}
                  disabled={!newPath.trim()}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  <Check size={12} />
                  Add
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setNewPath("");
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-surface text-muted text-xs font-medium hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Workspace Scanner */}
        {workspaceRoot && onScan && (
          <div className="border-t border-border">
            <WorkspaceScanner
              scannedProjects={scannedProjects}
              scanning={scanning}
              onScan={onScan}
              onAddProject={onAdd}
              addedPaths={new Set(projects.map((p) => p.workingDirectory))}
            />
          </div>
        )}

        {/* Add Project Button */}
        <div className="border-t border-border p-3">
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Plus size={16} />
            Add Project
          </button>
        </div>
      </div>
    </div>
  );
}
