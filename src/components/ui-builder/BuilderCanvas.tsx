"use client";

import { useRef, useCallback } from "react";
import { UIElement, UIElementType } from "@/types";
import CanvasElement from "./CanvasElement";

interface BuilderCanvasProps {
  elements: UIElement[];
  selectedId: string | null;
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  onDrop: (type: UIElementType, x: number, y: number) => void;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: (id: string) => void;
  onResize: (id: string, width: number, height: number) => void;
  onResizeEnd: (id: string) => void;
  onUpdateContent: (id: string, content: string) => void;
}

export default function BuilderCanvas({
  elements,
  selectedId,
  zoom,
  canvasWidth,
  canvasHeight,
  onDrop,
  onSelect,
  onMove,
  onMoveEnd,
  onResize,
  onResizeEnd,
  onUpdateContent,
}: BuilderCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/zecru-element") as UIElementType;
      if (!type || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      onDrop(type, Math.round(x), Math.round(y));
    },
    [zoom, onDrop]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Only deselect if clicking the canvas background itself
      if (e.target === canvasRef.current) {
        onSelect(null);
      }
    },
    [onSelect]
  );

  return (
    <div className="flex-1 overflow-auto bg-[#0d0d0d]">
      <div
        className="min-h-full flex items-start justify-center p-8"
        style={{ minWidth: canvasWidth * zoom + 64 }}
      >
        <div
          ref={canvasRef}
          className="relative border border-border/50 rounded-lg"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            backgroundImage:
              "radial-gradient(circle, #262626 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundColor: "#111111",
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleCanvasClick}
        >
          {elements.map((el) => (
            <CanvasElement
              key={el.id}
              element={el}
              isSelected={el.id === selectedId}
              zoom={zoom}
              onSelect={onSelect}
              onMove={onMove}
              onMoveEnd={onMoveEnd}
              onResize={onResize}
              onResizeEnd={onResizeEnd}
              onUpdateContent={onUpdateContent}
            />
          ))}

          {elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-muted text-sm mb-1">Drag components here to start designing</p>
                <p className="text-muted/50 text-xs">Drop elements from the left panel onto the canvas</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
