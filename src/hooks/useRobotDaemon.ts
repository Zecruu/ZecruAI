"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { ConnectionStatus, Message, ActivityEvent, ResultEvent } from "@/types";
import { FileEntry, WorkspaceScanResult, BrowseFilesResult, CommandOutput } from "@/types/robot";
import { v4 as uuidv4 } from "uuid";

function getRelayUrl(): string {
  if (process.env.NEXT_PUBLIC_RELAY_URL) {
    return process.env.NEXT_PUBLIC_RELAY_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

interface UseRobotDaemonOptions {
  pairingCode: string;
  onMessage: (message: Message) => void;
  onStreamUpdate: (id: string, content: string) => void;
  onPermissionRequest: (message: Message) => void;
  onTypingStart: () => void;
  onTypingEnd: () => void;
  onActivity: (activity: ActivityEvent) => void;
  onResult: (result: ResultEvent) => void;
  onScanResult?: (result: WorkspaceScanResult) => void;
  onBrowseResult?: (result: BrowseFilesResult) => void;
  onCommandOutput?: (data: { id: string; data: string; stream: "stdout" | "stderr" }) => void;
  onCommandDone?: (data: { id: string; exitCode: number; durationMs: number }) => void;
}

export function useRobotDaemon({
  pairingCode,
  onMessage,
  onStreamUpdate,
  onPermissionRequest,
  onTypingStart,
  onTypingEnd,
  onActivity,
  onResult,
  onScanResult,
  onBrowseResult,
  onCommandOutput,
  onCommandDone,
}: UseRobotDaemonOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    daemon: "disconnected",
    relay: "disconnected",
  });
  const responseBufferRef = useRef<string>("");
  const streamingIdRef = useRef<string | null>(null);

  // Store callbacks in refs
  const onMessageRef = useRef(onMessage);
  const onStreamUpdateRef = useRef(onStreamUpdate);
  const onPermissionRequestRef = useRef(onPermissionRequest);
  const onTypingStartRef = useRef(onTypingStart);
  const onTypingEndRef = useRef(onTypingEnd);
  const onActivityRef = useRef(onActivity);
  const onResultRef = useRef(onResult);
  const onScanResultRef = useRef(onScanResult);
  const onBrowseResultRef = useRef(onBrowseResult);
  const onCommandOutputRef = useRef(onCommandOutput);
  const onCommandDoneRef = useRef(onCommandDone);

  onMessageRef.current = onMessage;
  onStreamUpdateRef.current = onStreamUpdate;
  onPermissionRequestRef.current = onPermissionRequest;
  onTypingStartRef.current = onTypingStart;
  onTypingEndRef.current = onTypingEnd;
  onActivityRef.current = onActivity;
  onResultRef.current = onResult;
  onScanResultRef.current = onScanResult;
  onBrowseResultRef.current = onBrowseResult;
  onCommandOutputRef.current = onCommandOutput;
  onCommandDoneRef.current = onCommandDone;

  useEffect(() => {
    if (!pairingCode) return;
    if (socketRef.current?.connected) return;

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const relayUrl = getRelayUrl();
    console.log(`[useRobotDaemon] Connecting to relay at ${relayUrl} with code ${pairingCode}`);

    const socket = io(relayUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[useRobotDaemon] Connected to relay");
      setConnectionStatus((prev) => ({ ...prev, relay: "connected" }));
      socket.emit("client:join", { pairingCode });
    });

    socket.on("disconnect", () => {
      console.log("[useRobotDaemon] Disconnected from relay");
      setConnectionStatus({ daemon: "disconnected", relay: "disconnected" });
    });

    socket.on("connect_error", (err) => {
      console.log("[useRobotDaemon] Connection error:", err.message);
      setConnectionStatus((prev) => ({ ...prev, relay: "disconnected" }));
    });

    // Daemon status updates
    socket.on("daemon:status", (data: { status: string }) => {
      console.log("[useRobotDaemon] Daemon status:", data.status);
      setConnectionStatus((prev) => ({
        ...prev,
        daemon: data.status as ConnectionStatus["daemon"],
      }));
    });

    // Response streaming from daemon
    socket.on("client:response", (data: { content: string; type?: string; done?: boolean }) => {
      if (data.type === "error") {
        onTypingEndRef.current();
        onMessageRef.current({
          id: uuidv4(), role: "assistant", content: data.content, timestamp: Date.now(), type: "error",
        });
        responseBufferRef.current = "";
        streamingIdRef.current = null;
        return;
      }

      if (data.done) {
        onTypingEndRef.current();
        if (responseBufferRef.current && !streamingIdRef.current) {
          onMessageRef.current({
            id: uuidv4(), role: "assistant", content: responseBufferRef.current, timestamp: Date.now(), type: "text",
          });
        }
        responseBufferRef.current = "";
        streamingIdRef.current = null;
        return;
      }

      if (data.content) {
        responseBufferRef.current += data.content;
        if (!streamingIdRef.current) {
          const id = uuidv4();
          streamingIdRef.current = id;
          onMessageRef.current({
            id, role: "assistant", content: responseBufferRef.current, timestamp: Date.now(), type: "text",
          });
        } else {
          onStreamUpdateRef.current(streamingIdRef.current, responseBufferRef.current);
        }
        onTypingStartRef.current();
      }
    });

    // Activity events
    socket.on("client:activity", (data: ActivityEvent) => {
      onActivityRef.current(data);
      onTypingStartRef.current();
    });

    // Result events
    socket.on("client:result", (data: ResultEvent) => {
      onResultRef.current(data);
      if (data.text && !streamingIdRef.current && !responseBufferRef.current) {
        onMessageRef.current({
          id: uuidv4(), role: "assistant", content: data.text, timestamp: Date.now(), type: data.isError ? "error" : "text",
        });
      }
    });

    // Permission requests
    socket.on("client:permission_request", (data: { id: string; action: string; description: string; files?: string[] }) => {
      onTypingEndRef.current();
      onPermissionRequestRef.current({
        id: data.id, role: "assistant",
        content: JSON.stringify({ action: data.action, description: data.description, files: data.files }),
        timestamp: Date.now(), type: "permission",
      });
    });

    // Error when no daemon
    socket.on("error:no_daemon", (data: { message: string }) => {
      onTypingEndRef.current();
      onMessageRef.current({
        id: uuidv4(), role: "assistant", content: data.message, timestamp: Date.now(), type: "error",
      });
    });

    // --- Robot-specific events ---

    // Workspace scan results
    socket.on("client:scan-result", (data: WorkspaceScanResult) => {
      console.log("[useRobotDaemon] Scan result:", data.projects?.length, "projects");
      onScanResultRef.current?.(data);
    });

    // File browse results
    socket.on("client:browse-result", (data: BrowseFilesResult) => {
      onBrowseResultRef.current?.(data);
    });

    // Terminal command output (streaming)
    socket.on("client:command-output", (data: { id: string; data: string; stream: "stdout" | "stderr" }) => {
      onCommandOutputRef.current?.(data);
    });

    // Terminal command done
    socket.on("client:command-done", (data: { id: string; exitCode: number; durationMs: number }) => {
      onCommandDoneRef.current?.(data);
    });

    // Project created
    socket.on("client:project-created", (data: { path: string; name: string; success: boolean }) => {
      console.log("[useRobotDaemon] Project created:", data);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pairingCode]);

  // --- Actions ---

  const sendMessage = useCallback((content: string, conversationId?: string, autoApprove?: boolean, workingDir?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("client:message", { content, conversationId, autoApprove, workingDir });
    }
  }, []);

  const sendPermissionResponse = useCallback((id: string, approved: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("client:permission_response", { id, approved });
    }
  }, []);

  const scanWorkspace = useCallback((rootPath: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("client:scan-workspace", { rootPath }, (result: WorkspaceScanResult) => {
        onScanResultRef.current?.(result);
      });
    }
  }, []);

  const browseFiles = useCallback((filePath: string): Promise<BrowseFilesResult> => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected) {
        resolve({ path: filePath, entries: [] });
        return;
      }
      socketRef.current.emit("client:browse-files", { path: filePath }, (result: BrowseFilesResult) => {
        resolve(result);
      });
    });
  }, []);

  const runCommand = useCallback((command: string, workingDir: string) => {
    const id = uuidv4();
    if (socketRef.current?.connected) {
      socketRef.current.emit("client:run-command", { command, workingDir, id });
    }
    return id;
  }, []);

  const createProject = useCallback((projectPath: string, name: string, template?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("client:create-project", { path: projectPath, name, template });
    }
  }, []);

  return {
    connectionStatus,
    sendMessage,
    sendPermissionResponse,
    scanWorkspace,
    browseFiles,
    runCommand,
    createProject,
  };
}
