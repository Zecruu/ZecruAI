"use client";

import { useState, useRef, useEffect } from "react";
import { Terminal, X } from "lucide-react";
import { CommandOutput } from "@/types/robot";

interface TerminalPanelProps {
  workingDir: string;
  commands: CommandOutput[];
  onRunCommand: (command: string) => void;
  onClose?: () => void;
}

// Strip ANSI escape codes for clean display
function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1B\][^\x07]*\x07/g, "");
}

export default function TerminalPanel({ workingDir, commands, onRunCommand, onClose }: TerminalPanelProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [commands]);

  const handleSubmit = () => {
    const cmd = input.trim();
    if (!cmd) return;

    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    onRunCommand(cmd);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    }
  };

  const shortenPath = (p: string) => {
    const parts = p.replace(/\\/g, "/").split("/");
    return parts.length > 2 ? `~/${parts.slice(-2).join("/")}` : p;
  };

  return (
    <div className="h-full flex flex-col bg-[#1a1a2e] border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-[#16162a]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Terminal
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-surface rounded transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Output */}
      <div ref={outputRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {commands.map((cmd) => (
          <div key={cmd.id} className="mb-3">
            <div className="text-green-400">
              <span className="text-blue-400">{shortenPath(cmd.workingDir)}</span>
              <span className="text-muted-foreground"> $ </span>
              {cmd.command}
            </div>
            {cmd.chunks.map((chunk, i) => (
              <div
                key={i}
                className={chunk.stream === "stderr" ? "text-red-400/80" : "text-foreground/80"}
              >
                {stripAnsi(chunk.data)}
              </div>
            ))}
            {!cmd.running && cmd.exitCode !== null && cmd.exitCode !== 0 && (
              <div className="text-red-400 text-[10px] mt-0.5">
                Exit code: {cmd.exitCode}
              </div>
            )}
            {cmd.running && (
              <div className="text-yellow-400/60 text-[10px] mt-0.5 animate-pulse">
                Running...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-[#16162a] px-3 py-2 flex items-center gap-2">
        <span className="text-blue-400 text-xs font-mono">{shortenPath(workingDir)}</span>
        <span className="text-muted-foreground text-xs font-mono">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          className="flex-1 bg-transparent text-foreground text-xs font-mono outline-none placeholder:text-muted-foreground/50"
          autoFocus
        />
      </div>
    </div>
  );
}
