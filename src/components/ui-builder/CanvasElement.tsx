"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { UIElement } from "@/types";
import { ImageIcon } from "lucide-react";

interface CanvasElementProps {
  element: UIElement;
  isSelected: boolean;
  zoom: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: (id: string) => void;
  onResize: (id: string, width: number, height: number) => void;
  onResizeEnd: (id: string) => void;
  onUpdateContent: (id: string, content: string) => void;
  isNested?: boolean;
}

// Container types that can hold children
const CONTAINER_TYPES = ["container", "section", "navbar", "hero", "card", "form", "footer"];
const TEXT_TYPES = ["text", "heading", "button", "navbar", "hero", "footer"];

export default function CanvasElement({
  element,
  isSelected,
  zoom,
  onSelect,
  onMove,
  onMoveEnd,
  onResize,
  onResizeEnd,
  onUpdateContent,
  isNested = false,
}: CanvasElementProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(element.content || "");
  const editRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startElX: number;
    startElY: number;
  } | null>(null);
  const resizeRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startWidth: number;
    startHeight: number;
    handle: string;
  } | null>(null);

  const { style } = element;

  // Focus the edit textarea when entering edit mode
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing]);

  // --- Drag to move ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editing) return;
      e.stopPropagation();
      onSelect(element.id);

      // Don't start drag on resize handles
      if ((e.target as HTMLElement).dataset.resize) return;

      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startElX: style.x,
        startElY: style.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = (ev.clientX - dragRef.current.startMouseX) / zoom;
        const dy = (ev.clientY - dragRef.current.startMouseY) / zoom;
        onMove(
          element.id,
          Math.round(dragRef.current.startElX + dx),
          Math.round(dragRef.current.startElY + dy)
        );
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        onMoveEnd(element.id);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element.id, style.x, style.y, zoom, onSelect, onMove, onMoveEnd, editing]
  );

  // --- Resize ---
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault();

      resizeRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: style.width,
        startHeight: style.height,
        handle,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const dx = (ev.clientX - resizeRef.current.startMouseX) / zoom;
        const dy = (ev.clientY - resizeRef.current.startMouseY) / zoom;

        let newWidth = resizeRef.current.startWidth;
        let newHeight = resizeRef.current.startHeight;

        if (handle.includes("r")) newWidth = resizeRef.current.startWidth + dx;
        if (handle.includes("l")) newWidth = resizeRef.current.startWidth - dx;
        if (handle.includes("b")) newHeight = resizeRef.current.startHeight + dy;
        if (handle.includes("t")) newHeight = resizeRef.current.startHeight - dy;

        onResize(element.id, Math.round(newWidth), Math.round(newHeight));
      };

      const handleMouseUp = () => {
        resizeRef.current = null;
        onResizeEnd(element.id);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element.id, style.width, style.height, zoom, onResize, onResizeEnd]
  );

  // --- Double-click to edit text ---
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (TEXT_TYPES.includes(element.type) && element.content !== undefined) {
        setEditText(element.content || "");
        setEditing(true);
      }
    },
    [element.type, element.content]
  );

  const handleEditBlur = useCallback(() => {
    setEditing(false);
    if (editText !== element.content) {
      onUpdateContent(element.id, editText);
    }
  }, [editText, element.content, element.id, onUpdateContent]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleEditBlur();
      }
      if (e.key === "Escape") {
        setEditing(false);
        setEditText(element.content || "");
      }
    },
    [handleEditBlur, element.content]
  );

  // Build inline styles for the element
  const elementStyle: React.CSSProperties = {
    position: isNested ? "relative" : "absolute",
    left: isNested ? undefined : style.x,
    top: isNested ? undefined : style.y,
    width: style.width,
    height: style.height,
    backgroundColor: style.backgroundColor,
    color: style.textColor,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    borderRadius: style.borderRadius,
    border: style.borderWidth
      ? `${style.borderWidth}px solid ${style.borderColor || "#262626"}`
      : undefined,
    padding: style.padding,
    opacity: style.opacity,
    display: style.display,
    flexDirection: style.flexDirection,
    justifyContent: style.justifyContent,
    alignItems: style.alignItems,
    gap: style.gap,
    overflow: "hidden",
    cursor: editing ? "text" : "move",
    outline: isSelected ? "2px solid #6366f1" : "1px solid transparent",
    outlineOffset: isSelected ? 1 : 0,
    userSelect: editing ? "text" : "none",
    boxSizing: "border-box",
  };

  // Render inner content based on element type
  const renderContent = () => {
    if (editing) {
      return (
        <textarea
          ref={editRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleEditBlur}
          onKeyDown={handleEditKeyDown}
          className="w-full h-full bg-transparent resize-none outline-none"
          style={{
            color: style.textColor || "#ededed",
            fontSize: style.fontSize || 14,
            fontWeight: style.fontWeight || "normal",
            padding: 0,
          }}
        />
      );
    }

    switch (element.type) {
      case "heading":
        return (
          <span className="pointer-events-none truncate" style={{ lineHeight: 1.2 }}>
            {element.content || "Heading"}
          </span>
        );
      case "text":
        return (
          <span className="pointer-events-none" style={{ lineHeight: 1.5 }}>
            {element.content || "Text"}
          </span>
        );
      case "button":
        return (
          <span className="pointer-events-none">{element.content || "Button"}</span>
        );
      case "image":
        return (
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <ImageIcon size={32} className="mx-auto mb-1 opacity-30" />
              <span className="text-[10px] opacity-30">Image</span>
            </div>
          </div>
        );
      case "input":
        return (
          <div className="flex items-center w-full h-full pointer-events-none opacity-50">
            <span className="text-xs">{element.content || element.placeholder || "Input"}</span>
          </div>
        );
      case "divider":
        return <div className="w-full h-full" />;
      default:
        // Container types: render children or placeholder
        if (CONTAINER_TYPES.includes(element.type)) {
          if (element.children.length > 0) {
            return element.children.map((child) => (
              <CanvasElement
                key={child.id}
                element={child}
                isSelected={false}
                zoom={zoom}
                onSelect={onSelect}
                onMove={onMove}
                onMoveEnd={onMoveEnd}
                onResize={onResize}
                onResizeEnd={onResizeEnd}
                onUpdateContent={onUpdateContent}
                isNested
              />
            ));
          }
          return (
            <div className="flex items-center justify-center w-full h-full pointer-events-none">
              {element.content ? (
                <span>{element.content}</span>
              ) : (
                <span className="text-[10px] text-muted/40">
                  {element.name}
                </span>
              )}
            </div>
          );
        }
        return <span className="pointer-events-none">{element.content}</span>;
    }
  };

  return (
    <div
      style={elementStyle}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Element type label */}
      {isSelected && !isNested && (
        <div
          className="absolute -top-5 left-0 text-[9px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {element.name}
        </div>
      )}

      {renderContent()}

      {/* Resize handles (only when selected and not nested) */}
      {isSelected && !isNested && !editing && (
        <>
          {/* Top-left */}
          <div
            data-resize="tl"
            className="absolute w-2.5 h-2.5 bg-accent border border-white rounded-sm"
            style={{ top: -5, left: -5, cursor: "nwse-resize", zIndex: 20 }}
            onMouseDown={(e) => handleResizeMouseDown(e, "tl")}
          />
          {/* Top-right */}
          <div
            data-resize="tr"
            className="absolute w-2.5 h-2.5 bg-accent border border-white rounded-sm"
            style={{ top: -5, right: -5, cursor: "nesw-resize", zIndex: 20 }}
            onMouseDown={(e) => handleResizeMouseDown(e, "tr")}
          />
          {/* Bottom-left */}
          <div
            data-resize="bl"
            className="absolute w-2.5 h-2.5 bg-accent border border-white rounded-sm"
            style={{ bottom: -5, left: -5, cursor: "nesw-resize", zIndex: 20 }}
            onMouseDown={(e) => handleResizeMouseDown(e, "bl")}
          />
          {/* Bottom-right */}
          <div
            data-resize="br"
            className="absolute w-2.5 h-2.5 bg-accent border border-white rounded-sm"
            style={{ bottom: -5, right: -5, cursor: "nwse-resize", zIndex: 20 }}
            onMouseDown={(e) => handleResizeMouseDown(e, "br")}
          />
        </>
      )}
    </div>
  );
}
