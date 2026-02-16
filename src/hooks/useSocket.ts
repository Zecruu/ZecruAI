"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { ConnectionStatus, Message, ActivityEvent, ResultEvent } from "@/types";
import { v4 as uuidv4 } from "uuid";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || "http://localhost:3001";

interface UseSocketOptions {
  pairingCode: string;
  onMessage: (message: Message) => void;
  onPermissionRequest: (message: Message) => void;
  onTypingStart: () => void;
  onTypingEnd: () => void;
  onActivity: (activity: ActivityEvent) => void;
  onResult: (result: ResultEvent) => void;
}

export function useSocket({
  pairingCode,
  onMessage,
  onPermissionRequest,
  onTypingStart,
  onTypingEnd,
  onActivity,
  onResult,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    daemon: "disconnected",
    relay: "disconnected",
  });
  const responseBufferRef = useRef<string>("");

  // Store callbacks in refs so we don't get stale closures
  const onMessageRef = useRef(onMessage);
  const onPermissionRequestRef = useRef(onPermissionRequest);
  const onTypingStartRef = useRef(onTypingStart);
  const onTypingEndRef = useRef(onTypingEnd);
  const onActivityRef = useRef(onActivity);
  const onResultRef = useRef(onResult);

  onMessageRef.current = onMessage;
  onPermissionRequestRef.current = onPermissionRequest;
  onTypingStartRef.current = onTypingStart;
  onTypingEndRef.current = onTypingEnd;
  onActivityRef.current = onActivity;
  onResultRef.current = onResult;

  // Connect to relay when pairing code is available
  useEffect(() => {
    if (!pairingCode) return;

    // Don't reconnect if already connected with same code
    if (socketRef.current?.connected) return;

    // Clean up previous connection
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    console.log(`[useSocket] Connecting to relay at ${RELAY_URL} with code ${pairingCode}`);

    const socket = io(RELAY_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[useSocket] Connected to relay");
      setConnectionStatus((prev) => ({ ...prev, relay: "connected" }));
      socket.emit("client:join", { pairingCode });
    });

    socket.on("disconnect", () => {
      console.log("[useSocket] Disconnected from relay");
      setConnectionStatus({ daemon: "disconnected", relay: "disconnected" });
    });

    socket.on("connect_error", (err) => {
      console.log("[useSocket] Connection error:", err.message);
      setConnectionStatus((prev) => ({ ...prev, relay: "disconnected" }));
    });

    // Daemon status updates
    socket.on("daemon:status", (data: { status: string }) => {
      console.log("[useSocket] Daemon status:", data.status);
      setConnectionStatus((prev) => ({
        ...prev,
        daemon: data.status as ConnectionStatus["daemon"],
      }));
    });

    // Response streaming from daemon (text chunks)
    socket.on("client:response", (data: { content: string; type?: string; done?: boolean }) => {
      if (data.type === "error") {
        onTypingEndRef.current();
        onMessageRef.current({
          id: uuidv4(),
          role: "assistant",
          content: data.content,
          timestamp: Date.now(),
          type: "error",
        });
        responseBufferRef.current = "";
        return;
      }

      if (data.done) {
        onTypingEndRef.current();
        // If we have buffered text, emit it as a message
        if (responseBufferRef.current) {
          onMessageRef.current({
            id: uuidv4(),
            role: "assistant",
            content: responseBufferRef.current,
            timestamp: Date.now(),
            type: "text",
          });
        }
        responseBufferRef.current = "";
        return;
      }

      if (data.content) {
        responseBufferRef.current += data.content;
        onTypingStartRef.current();
      }
    });

    // Live activity events (tool use, progress, status)
    socket.on("client:activity", (data: ActivityEvent) => {
      console.log("[useSocket] Activity:", data.message);
      onActivityRef.current(data);
      // Activity means Claude is working — show typing
      onTypingStartRef.current();
    });

    // Final result event (with cost, duration, session ID)
    socket.on("client:result", (data: ResultEvent) => {
      console.log("[useSocket] Result:", data.isError ? "ERROR" : "OK", `$${data.costUsd.toFixed(4)}`);
      onResultRef.current(data);

      // If the result has text and we haven't already streamed it, emit as message
      if (data.text && !responseBufferRef.current) {
        onMessageRef.current({
          id: uuidv4(),
          role: "assistant",
          content: data.text,
          timestamp: Date.now(),
          type: data.isError ? "error" : "text",
        });
      }
    });

    // Permission requests from daemon
    socket.on("client:permission_request", (data: {
      id: string;
      action: string;
      description: string;
      files?: string[];
    }) => {
      onTypingEndRef.current();
      onPermissionRequestRef.current({
        id: data.id,
        role: "assistant",
        content: JSON.stringify({
          action: data.action,
          description: data.description,
          files: data.files,
        }),
        timestamp: Date.now(),
        type: "permission",
      });
    });

    // Error when no daemon connected
    socket.on("error:no_daemon", (data: { message: string }) => {
      onTypingEndRef.current();
      onMessageRef.current({
        id: uuidv4(),
        role: "assistant",
        content: data.message,
        timestamp: Date.now(),
        type: "error",
      });
    });

    // Cleanup on unmount
    return () => {
      console.log("[useSocket] Cleaning up");
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pairingCode]);

  const sendMessage = useCallback((content: string, conversationId?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("client:message", { content, conversationId });
    }
  }, []);

  const sendPermissionResponse = useCallback((id: string, approved: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("client:permission_response", { id, approved });
    }
  }, []);

  return {
    connectionStatus,
    sendMessage,
    sendPermissionResponse,
  };
}
