"use client";

import { TabMode } from "@/types";
import { MessageSquare, Code2, Zap, Shield, Globe, Terminal } from "lucide-react";

interface EmptyStateProps {
  mode: TabMode;
}

export default function EmptyState({ mode }: EmptyStateProps) {
  if (mode === "user") {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
          <MessageSquare size={28} className="text-accent" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Hey there!
        </h2>
        <p className="text-sm text-muted max-w-xs mb-8">
          I&apos;m ZecruAI. Ask me anything — I&apos;m here to help with
          whatever you need.
        </p>
        <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
          {[
            { icon: Zap, text: "Help me write an email" },
            { icon: Globe, text: "Explain something to me" },
            { icon: Shield, text: "Help me plan my week" },
          ].map((item, i) => (
            <button
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left text-sm text-foreground hover:bg-surface-hover active:scale-[0.98] transition-all"
            >
              <item.icon size={16} className="text-accent flex-shrink-0" />
              {item.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
        <Terminal size={28} className="text-accent" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Developer Mode
      </h2>
      <p className="text-sm text-muted max-w-xs mb-8">
        Connect to Claude Code on your machine. Send commands, approve
        permissions, and manage your codebase from anywhere.
      </p>
      <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
        {[
          { icon: Code2, text: "Refactor the auth module" },
          { icon: Terminal, text: "Run the test suite" },
          { icon: Zap, text: "Add a new API endpoint" },
        ].map((item, i) => (
          <button
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-left text-sm text-foreground hover:bg-surface-hover active:scale-[0.98] transition-all"
          >
            <item.icon size={16} className="text-accent flex-shrink-0" />
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}
