"use client";

import { useState, useRef, useEffect } from "react";
import { X, Copy, Check, Loader2 } from "lucide-react";

interface CodePreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  loading: boolean;
}

export default function CodePreviewPanel({
  isOpen,
  onClose,
  code,
  loading,
}: CodePreviewPanelProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom as code streams in
  useEffect(() => {
    if (codeRef.current && loading) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [code, loading]);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-5xl bg-background border border-border rounded-t-2xl animate-slide-up"
        style={{ maxHeight: "70vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">Generated Code</h3>
            {loading && (
              <div className="flex items-center gap-1.5 text-accent">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Generating...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!code}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors disabled:opacity-30"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Code"}
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Code area */}
        <pre
          ref={codeRef}
          className="overflow-auto p-5 text-xs leading-relaxed font-mono"
          style={{ maxHeight: "calc(70vh - 56px)" }}
        >
          {code ? (
            <code className="text-accent/90 whitespace-pre-wrap break-words">{code}</code>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted text-sm">
              {loading ? "Waiting for AI response..." : "No code generated yet"}
            </div>
          )}
        </pre>
      </div>
    </div>
  );
}
