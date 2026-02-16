"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Mic } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 py-3 safe-bottom">
      <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl px-3 py-2 focus-within:border-accent/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Message ZecruAI..."}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder-muted outline-none resize-none max-h-[120px] py-1.5"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
            input.trim()
              ? "bg-accent text-white hover:bg-accent-hover"
              : "bg-surface-hover text-muted"
          }`}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
