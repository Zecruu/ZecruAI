"use client";

import { ConnectionStatus } from "@/types";
import {
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Code2,
  Loader2,
} from "lucide-react";

interface BuilderToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  selectedId: string | null;
  onDelete: () => void;
  onTurnToCode: () => void;
  aiLoading: boolean;
  connectionStatus: ConnectionStatus;
  elementCount: number;
}

export default function BuilderToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomChange,
  selectedId,
  onDelete,
  onTurnToCode,
  aiLoading,
  connectionStatus,
  elementCount,
}: BuilderToolbarProps) {
  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-xl px-4 py-2 flex items-center justify-between shrink-0">
      {/* Left: Undo/Redo + Delete */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Redo"
        >
          <Redo2 size={16} />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={onDelete}
          disabled={!selectedId}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-surface transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Delete selected"
        >
          <Trash2 size={16} />
        </button>
        <span className="text-[10px] text-muted/50 ml-2">
          {elementCount} element{elementCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Center: Zoom */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onZoomChange(zoom - 0.1)}
          disabled={zoom <= 0.2}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={() => onZoomChange(1)}
          className="text-xs text-muted hover:text-foreground w-12 text-center transition-colors"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => onZoomChange(zoom + 0.1)}
          disabled={zoom >= 1.5}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
      </div>

      {/* Right: Turn to Code */}
      <button
        onClick={onTurnToCode}
        disabled={aiLoading || connectionStatus.daemon !== "connected" || elementCount === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
      >
        {aiLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Code2 size={16} />
        )}
        Turn to Code
      </button>
    </div>
  );
}
