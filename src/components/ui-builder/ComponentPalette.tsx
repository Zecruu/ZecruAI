"use client";

import { useState } from "react";
import { UIElementType } from "@/types";
import { ELEMENT_TEMPLATES } from "./elementTemplates";
import {
  Menu,
  Sparkles,
  LayoutGrid,
  CreditCard,
  SquareDashed,
  MousePointerClick,
  Type,
  AlignLeft,
  ImageIcon,
  TextCursorInput,
  ClipboardList,
  Minus,
  PanelBottom,
  Search,
  GripVertical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Menu,
  Sparkles,
  LayoutGrid,
  CreditCard,
  SquareDashed,
  MousePointerClick,
  Type,
  AlignLeft,
  ImageIcon,
  TextCursorInput,
  ClipboardList,
  Minus,
  PanelBottom,
};

export default function ComponentPalette() {
  const [search, setSearch] = useState("");

  const filtered = ELEMENT_TEMPLATES.filter((t) =>
    t.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, type: UIElementType) => {
    e.dataTransfer.setData("application/zecru-element", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="w-56 border-r border-border bg-background flex flex-col shrink-0">
      <div className="px-3 py-3 border-b border-border">
        <h3 className="text-xs font-semibold text-foreground mb-2">Components</h3>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.map((template) => {
          const IconComp = ICON_MAP[template.icon];
          return (
            <div
              key={template.type}
              draggable
              onDragStart={(e) => handleDragStart(e, template.type)}
              className="flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg cursor-grab text-muted hover:text-foreground hover:bg-surface transition-colors active:cursor-grabbing"
            >
              <GripVertical size={12} className="opacity-30 shrink-0" />
              {IconComp && <IconComp size={16} className="shrink-0" />}
              <span className="text-xs font-medium">{template.label}</span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">No components found</div>
        )}
      </div>
    </div>
  );
}
