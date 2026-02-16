"use client";

import { TabMode } from "@/types";
import { User, Code2 } from "lucide-react";

interface TabSwitcherProps {
  active: TabMode;
  onChange: (tab: TabMode) => void;
}

export default function TabSwitcher({ active, onChange }: TabSwitcherProps) {
  return (
    <div className="flex bg-surface rounded-xl p-1 border border-border">
      <button
        onClick={() => onChange("user")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          active === "user"
            ? "bg-accent text-white shadow-sm"
            : "text-muted hover:text-foreground"
        }`}
      >
        <User size={16} />
        User
      </button>
      <button
        onClick={() => onChange("developer")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          active === "developer"
            ? "bg-accent text-white shadow-sm"
            : "text-muted hover:text-foreground"
        }`}
      >
        <Code2 size={16} />
        Developer
      </button>
    </div>
  );
}
