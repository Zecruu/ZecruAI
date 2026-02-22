"use client";

import { UIElement, UIElementStyle } from "@/types";
import { X, Trash2 } from "lucide-react";

interface PropertiesPanelProps {
  element: UIElement;
  onUpdateStyle: (id: string, style: Partial<UIElementStyle>) => void;
  onUpdateContent: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const COLOR_PRESETS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6",
  "#0a0a0a", "#141414", "#1e1e1e", "#262626",
  "#737373", "#ededed", "#ffffff", "transparent",
];

const FONT_WEIGHTS = [
  { label: "Light", value: "300" },
  { label: "Normal", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Semibold", value: "600" },
  { label: "Bold", value: "700" },
  { label: "Extra Bold", value: "800" },
];

const CONTAINER_TYPES = ["container", "section", "navbar", "hero", "card", "form", "footer"];

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[11px] text-muted">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-accent/50 transition-colors"
      />
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted">{label}</label>
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded border border-border"
            style={{ backgroundColor: value || "transparent" }}
          />
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="w-[72px] bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-accent/50 transition-colors font-mono"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-4 h-4 rounded border transition-transform hover:scale-125 ${
              value === color ? "border-accent" : "border-border"
            }`}
            style={{
              backgroundColor: color === "transparent" ? undefined : color,
              backgroundImage:
                color === "transparent"
                  ? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)"
                  : undefined,
              backgroundSize: color === "transparent" ? "6px 6px" : undefined,
              backgroundPosition:
                color === "transparent" ? "0 0, 3px 3px" : undefined,
            }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

export default function PropertiesPanel({
  element,
  onUpdateStyle,
  onUpdateContent,
  onDelete,
  onClose,
}: PropertiesPanelProps) {
  const { style } = element;
  const isContainer = CONTAINER_TYPES.includes(element.type);
  const hasContent = element.content !== undefined;

  return (
    <div className="w-64 border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
            {element.type}
          </span>
          <span className="text-xs font-medium text-foreground truncate">{element.name}</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Position & Size */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Position & Size</h4>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X" value={style.x} onChange={(v) => onUpdateStyle(element.id, { x: v })} />
            <NumberInput label="Y" value={style.y} onChange={(v) => onUpdateStyle(element.id, { y: v })} />
            <NumberInput label="W" value={style.width} onChange={(v) => onUpdateStyle(element.id, { width: v })} />
            <NumberInput label="H" value={style.height} onChange={(v) => onUpdateStyle(element.id, { height: v })} />
          </div>
        </div>

        {/* Content */}
        {hasContent && (
          <div className="px-3 py-3 border-b border-border space-y-2">
            <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Content</h4>
            <textarea
              value={element.content || ""}
              onChange={(e) => onUpdateContent(element.id, e.target.value)}
              rows={3}
              className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent/50 transition-colors resize-none"
            />
          </div>
        )}

        {/* Background */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Background</h4>
          <ColorInput
            label="Color"
            value={style.backgroundColor}
            onChange={(v) => onUpdateStyle(element.id, { backgroundColor: v })}
          />
        </div>

        {/* Typography */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Typography</h4>
          <NumberInput
            label="Font Size"
            value={style.fontSize}
            onChange={(v) => onUpdateStyle(element.id, { fontSize: v })}
          />
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-muted">Weight</label>
            <select
              value={style.fontWeight || "400"}
              onChange={(e) => onUpdateStyle(element.id, { fontWeight: e.target.value })}
              className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-accent/50 transition-colors"
            >
              {FONT_WEIGHTS.map((fw) => (
                <option key={fw.value} value={fw.value}>
                  {fw.label}
                </option>
              ))}
            </select>
          </div>
          <ColorInput
            label="Text Color"
            value={style.textColor}
            onChange={(v) => onUpdateStyle(element.id, { textColor: v })}
          />
        </div>

        {/* Border */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Border</h4>
          <NumberInput
            label="Radius"
            value={style.borderRadius}
            onChange={(v) => onUpdateStyle(element.id, { borderRadius: v })}
          />
          <NumberInput
            label="Width"
            value={style.borderWidth}
            onChange={(v) => onUpdateStyle(element.id, { borderWidth: v })}
          />
          <ColorInput
            label="Color"
            value={style.borderColor}
            onChange={(v) => onUpdateStyle(element.id, { borderColor: v })}
          />
        </div>

        {/* Spacing */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Spacing</h4>
          <NumberInput
            label="Padding"
            value={style.padding}
            onChange={(v) => onUpdateStyle(element.id, { padding: v })}
          />
          {isContainer && (
            <NumberInput
              label="Gap"
              value={style.gap}
              onChange={(v) => onUpdateStyle(element.id, { gap: v })}
            />
          )}
        </div>

        {/* Layout (for containers) */}
        {isContainer && (
          <div className="px-3 py-3 border-b border-border space-y-2">
            <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Layout</h4>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted">Direction</label>
              <select
                value={style.flexDirection || "column"}
                onChange={(e) =>
                  onUpdateStyle(element.id, {
                    display: "flex",
                    flexDirection: e.target.value as "row" | "column",
                  })
                }
                className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-accent/50 transition-colors"
              >
                <option value="row">Row</option>
                <option value="column">Column</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted">Justify</label>
              <select
                value={style.justifyContent || "flex-start"}
                onChange={(e) => onUpdateStyle(element.id, { justifyContent: e.target.value })}
                className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-accent/50 transition-colors"
              >
                <option value="flex-start">Start</option>
                <option value="center">Center</option>
                <option value="flex-end">End</option>
                <option value="space-between">Between</option>
                <option value="space-around">Around</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted">Align</label>
              <select
                value={style.alignItems || "stretch"}
                onChange={(e) => onUpdateStyle(element.id, { alignItems: e.target.value })}
                className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-accent/50 transition-colors"
              >
                <option value="stretch">Stretch</option>
                <option value="flex-start">Start</option>
                <option value="center">Center</option>
                <option value="flex-end">End</option>
              </select>
            </div>
          </div>
        )}

        {/* Opacity */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Opacity</h4>
          <NumberInput
            label="Opacity"
            value={style.opacity !== undefined ? style.opacity * 100 : 100}
            onChange={(v) => onUpdateStyle(element.id, { opacity: Math.max(0, Math.min(100, v)) / 100 })}
          />
        </div>

        {/* Delete */}
        <div className="px-3 py-3">
          <button
            onClick={() => onDelete(element.id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-danger/10 text-danger text-xs font-medium hover:bg-danger/20 transition-colors"
          >
            <Trash2 size={14} />
            Delete Element
          </button>
        </div>
      </div>
    </div>
  );
}
