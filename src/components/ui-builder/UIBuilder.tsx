"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ConnectionStatus, UIElement, UIElementType } from "@/types";
import { ELEMENT_TEMPLATES, createElementFromTemplate } from "./elementTemplates";
import ComponentPalette from "./ComponentPalette";
import BuilderCanvas from "./BuilderCanvas";
import PropertiesPanel from "./PropertiesPanel";
import BuilderToolbar from "./BuilderToolbar";
import CodePreviewPanel from "./CodePreviewPanel";

interface UIBuilderProps {
  connectionStatus: ConnectionStatus;
  onSendToAI: (prompt: string) => void;
  aiResponse: string | null;
  aiLoading: boolean;
}

// Helper: recursively find an element by ID
function findElement(elements: UIElement[], id: string): UIElement | null {
  for (const el of elements) {
    if (el.id === id) return el;
    const found = findElement(el.children, id);
    if (found) return found;
  }
  return null;
}

// Helper: recursively update an element by ID (immutable)
function updateElementInTree(
  elements: UIElement[],
  id: string,
  updater: (el: UIElement) => UIElement
): UIElement[] {
  return elements.map((el) => {
    if (el.id === id) return updater(el);
    if (el.children.length > 0) {
      return { ...el, children: updateElementInTree(el.children, id, updater) };
    }
    return el;
  });
}

// Helper: recursively remove an element by ID
function removeElementFromTree(elements: UIElement[], id: string): UIElement[] {
  return elements
    .filter((el) => el.id !== id)
    .map((el) => ({
      ...el,
      children: removeElementFromTree(el.children, id),
    }));
}

function buildTurnToCodePrompt(elements: UIElement[]): string {
  const designJson = JSON.stringify(elements, null, 2);

  return `You are a frontend developer. Convert the following visual design (represented as a JSON tree of UI elements) into clean, semantic HTML using Tailwind CSS classes.

DESIGN JSON:
${designJson}

RULES:
1. Output ONLY the HTML code, no explanations or markdown code fences.
2. Use Tailwind CSS utility classes for all styling. Do not use inline styles.
3. Use semantic HTML elements (nav, main, section, footer, h1-h6, p, button, etc.).
4. Make the layout responsive using Tailwind responsive prefixes where sensible.
5. Map element styles to appropriate Tailwind classes:
   - backgroundColor -> bg-[color] classes
   - borderRadius -> rounded-* classes
   - fontSize -> text-* classes
   - padding -> p-* classes
   - gap -> gap-* classes
   - display flex + flexDirection -> flex flex-col/flex-row
   - justifyContent -> justify-* classes
   - alignItems -> items-* classes
6. Use the element content for text.
7. For image elements, use a placeholder img tag with alt text.
8. Produce a complete, valid HTML document with a <head> that includes the Tailwind CDN script tag.
9. Keep the code clean and well-indented.
10. Respect the visual hierarchy and layout of the design - elements positioned near the top should be first in the HTML.

Generate the HTML now:`;
}

export default function UIBuilder({
  connectionStatus,
  onSendToAI,
  aiResponse,
  aiLoading,
}: UIBuilderProps) {
  const [elements, setElements] = useState<UIElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasWidth] = useState(1280);
  const [canvasHeight] = useState(2000);
  const [zoom, setZoom] = useState(0.6);
  const [codePreviewOpen, setCodePreviewOpen] = useState(false);

  // Undo/redo
  const [history, setHistory] = useState<UIElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback(
    (newElements: UIElement[]) => {
      setHistory((prev) => {
        const truncated = prev.slice(0, historyIndex + 1);
        return [...truncated, newElements].slice(-50);
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setElements(history[newIndex]);
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setElements(history[newIndex]);
  }, [historyIndex, history]);

  // Drop a new element onto the canvas
  const handleDrop = useCallback(
    (type: UIElementType, x: number, y: number) => {
      const template = ELEMENT_TEMPLATES.find((t) => t.type === type);
      if (!template) return;
      const newElement = createElementFromTemplate(template, x, y);
      const newElements = [...elements, newElement];
      setElements(newElements);
      pushHistory(newElements);
      setSelectedId(newElement.id);
    },
    [elements, pushHistory]
  );

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const handleMove = useCallback(
    (id: string, x: number, y: number) => {
      const newElements = updateElementInTree(elements, id, (el) => ({
        ...el,
        style: { ...el.style, x, y },
      }));
      setElements(newElements);
    },
    [elements]
  );

  const handleMoveEnd = useCallback(
    (id: string) => {
      pushHistory(elements);
    },
    [elements, pushHistory]
  );

  const handleResize = useCallback(
    (id: string, width: number, height: number) => {
      const newElements = updateElementInTree(elements, id, (el) => ({
        ...el,
        style: { ...el.style, width: Math.max(20, width), height: Math.max(20, height) },
      }));
      setElements(newElements);
    },
    [elements]
  );

  const handleResizeEnd = useCallback(
    (id: string) => {
      pushHistory(elements);
    },
    [elements, pushHistory]
  );

  const handleUpdateStyle = useCallback(
    (id: string, style: Partial<UIElement["style"]>) => {
      const newElements = updateElementInTree(elements, id, (el) => ({
        ...el,
        style: { ...el.style, ...style },
      }));
      setElements(newElements);
      pushHistory(newElements);
    },
    [elements, pushHistory]
  );

  const handleUpdateContent = useCallback(
    (id: string, content: string) => {
      const newElements = updateElementInTree(elements, id, (el) => ({
        ...el,
        content,
      }));
      setElements(newElements);
      pushHistory(newElements);
    },
    [elements, pushHistory]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const newElements = removeElementFromTree(elements, id);
      setElements(newElements);
      pushHistory(newElements);
      if (selectedId === id) setSelectedId(null);
    },
    [elements, pushHistory, selectedId]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedId) handleDelete(selectedId);
  }, [selectedId, handleDelete]);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.max(0.2, Math.min(1.5, newZoom)));
  }, []);

  const handleTurnToCode = useCallback(() => {
    if (elements.length === 0) return;
    const prompt = buildTurnToCodePrompt(elements);
    onSendToAI(prompt);
    setCodePreviewOpen(true);
  }, [elements, onSendToAI]);

  const selectedElement = selectedId ? findElement(elements, selectedId) : null;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          handleDelete(selectedId);
        }
      } else if (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, handleDelete, handleUndo, handleRedo]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Component Palette */}
        <ComponentPalette />

        {/* Center: Canvas */}
        <BuilderCanvas
          elements={elements}
          selectedId={selectedId}
          zoom={zoom}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onDrop={handleDrop}
          onSelect={handleSelect}
          onMove={handleMove}
          onMoveEnd={handleMoveEnd}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          onUpdateContent={handleUpdateContent}
        />

        {/* Right: Properties Panel */}
        {selectedElement && (
          <PropertiesPanel
            element={selectedElement}
            onUpdateStyle={handleUpdateStyle}
            onUpdateContent={handleUpdateContent}
            onDelete={handleDelete}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Bottom: Toolbar */}
      <BuilderToolbar
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        selectedId={selectedId}
        onDelete={handleDeleteSelected}
        onTurnToCode={handleTurnToCode}
        aiLoading={aiLoading}
        connectionStatus={connectionStatus}
        elementCount={elements.length}
      />

      {/* Code Preview */}
      <CodePreviewPanel
        isOpen={codePreviewOpen}
        onClose={() => setCodePreviewOpen(false)}
        code={aiResponse || ""}
        loading={aiLoading}
      />
    </div>
  );
}
