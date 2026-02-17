"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Message,
  ActivityEvent,
  ResultEvent,
  Conversation,
  Project,
} from "@/types";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import EmptyState from "@/components/EmptyState";
import SettingsPanel from "@/components/SettingsPanel";
import ConversationSidebar from "@/components/ConversationSidebar";
import ProjectSidebar from "@/components/ProjectSidebar";

function generateTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\n/g, " ").trim();
  return clean.length > 50 ? clean.substring(0, 50) + "..." : clean;
}

function generateSummary(assistantMessage: string): string {
  const lines = assistantMessage.split("\n").filter((l) => l.trim());
  const firstLine = lines[0]?.trim() || "";
  return firstLine.length > 80
    ? firstLine.substring(0, 80) + "..."
    : firstLine;
}

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<ActivityEvent | null>(null);
  const [sessionActivated, setSessionActivated] = useState(false);
  const [dangerousMode, setDangerousMode] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [connectedProjectIds, setConnectedProjectIds] = useState<Set<string>>(new Set());

  // Conversation history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pairing code comes from user account
  const pairingCode = user?.pairingCode || "";

  // Derive active project
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  // Local mode: include project ID for multi-project isolation
  // Remote mode: use base pairing code only (daemon connects with base code)
  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1");
  const effectivePairingCode =
    isLocal && activeProjectId
      ? `${pairingCode}-${activeProjectId}`
      : pairingCode;

  // Ref to track save debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh which daemons are running from the status API
  const refreshDaemonStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/daemon/status");
      const data = await res.json();
      if (data.daemons) {
        const ids = new Set<string>(
          Object.entries(data.daemons)
            .filter(([, d]: [string, unknown]) => (d as { running: boolean }).running)
            .map(([id]) => id)
        );
        setConnectedProjectIds(ids);
      }
    } catch {
      // ignore
    }
  }, []);

  // Real WebSocket connection
  const {
    connectionStatus,
    sendMessage: socketSendMessage,
    sendPermissionResponse,
  } = useSocket({
    pairingCode: effectivePairingCode,
    onMessage: useCallback((msg: Message) => {
      setMessages((prev) => {
        // Avoid duplicate if message with same ID already exists (from streaming)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    }, []),
    onStreamUpdate: useCallback((id: string, content: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content } : m))
      );
    }, []),
    onPermissionRequest: useCallback((msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    }, []),
    onTypingStart: useCallback(() => setIsTyping(true), []),
    onTypingEnd: useCallback(() => {
      setIsTyping(false);
      setCurrentActivity(null);
    }, []),
    onActivity: useCallback((activity: ActivityEvent) => {
      setCurrentActivity(activity);
      if (activity.type === "tool_use" && activity.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "system",
            content: activity.message,
            timestamp: Date.now(),
            type: "activity",
          },
        ]);
      }
    }, []),
    onResult: useCallback(
      (result: ResultEvent) => {
        if (result.durationMs > 0) {
          const seconds = (result.durationMs / 1000).toFixed(1);
          setMessages((prev) => [
            ...prev,
            {
              id: uuidv4(),
              role: "system",
              content: `Completed in ${seconds}s`,
              timestamp: Date.now(),
              type: "status",
            },
          ]);
        }
        // Save sessionId to active conversation for --resume
        if (result.sessionId && activeConversationId) {
          fetch(`/api/conversations/${activeConversationId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: result.sessionId }),
          }).catch(() => {});

          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, sessionId: result.sessionId! }
                : c
            )
          );
        }
        setCurrentActivity(null);
      },
      [activeConversationId]
    ),
  });

  // Track connected project IDs from socket daemon status
  useEffect(() => {
    if (activeProjectId) {
      setConnectedProjectIds((prev) => {
        const next = new Set(prev);
        if (connectionStatus.daemon === "connected") {
          next.add(activeProjectId);
        } else {
          next.delete(activeProjectId);
        }
        return next;
      });
    }
  }, [connectionStatus.daemon, activeProjectId]);

  // Show "Session Activated" when daemon first connects
  useEffect(() => {
    if (connectionStatus.daemon === "connected" && !sessionActivated) {
      setSessionActivated(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "system",
          content: "Claude Session Activated — ready to receive commands",
          timestamp: Date.now(),
          type: "status",
        },
      ]);
    } else if (connectionStatus.daemon === "disconnected") {
      setSessionActivated(false);
    }
  }, [connectionStatus.daemon, sessionActivated]);

  // Load data from API on mount (when user is available)
  useEffect(() => {
    if (!user || dataLoaded) return;

    setDangerousMode(user.dangerousMode);

    // Fetch projects and conversations from API
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/conversations").then((r) => r.json()),
    ])
      .then(([projectsData, conversationsData]) => {
        const loadedProjects: Project[] = projectsData.projects || [];
        setProjects(loadedProjects);

        const loadedConversations: Conversation[] = conversationsData.conversations || [];
        setConversations(loadedConversations);

        // Auto-select first project if any
        if (loadedProjects.length > 0) {
          setActiveProjectId(loadedProjects[0].id);
        }

        setDataLoaded(true);
      })
      .catch(() => {
        setDataLoaded(true);
      });

    refreshDaemonStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Save current messages to active conversation whenever messages change (debounced)
  useEffect(() => {
    if (messages.length === 0) return;
    if (!dataLoaded) return;

    // Debounce saves to avoid hammering the API
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (activeConversationId) {
        // Update existing conversation
        const convo = conversations.find((c) => c.id === activeConversationId);
        const patch: Record<string, unknown> = { messages };
        if (convo && !convo.summary) {
          const firstAssistant = messages.find(
            (m) => m.role === "assistant" && m.type !== "error"
          );
          if (firstAssistant) {
            patch.summary = generateSummary(firstAssistant.content);
          }
        }
        fetch(`/api/conversations/${activeConversationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).catch(() => {});

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages, updatedAt: Date.now(), ...(patch.summary ? { summary: patch.summary as string } : {}) }
              : c
          )
        );
      } else {
        // Create new conversation from first user message
        const firstUserMsg = messages.find((m) => m.role === "user");
        if (!firstUserMsg) return;

        const firstAssistant = messages.find(
          (m) => m.role === "assistant" && m.type !== "error"
        );

        const title = generateTitle(firstUserMsg.content);
        const summary = firstAssistant ? generateSummary(firstAssistant.content) : "";

        fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            summary,
            mode: "developer",
            messages,
            projectId: activeProjectId || null,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.conversation) {
              setActiveConversationId(data.conversation.id);
              setConversations((prev) => [...prev, data.conversation]);
            }
          })
          .catch(() => {});
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, activeConversationId, activeProjectId, conversations, dataLoaded]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, currentActivity]);

  // --- Project handlers ---
  const handleAddProject = useCallback(
    async (name: string, workingDirectory: string) => {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, workingDirectory }),
        });
        const data = await res.json();
        if (data.project) {
          setProjects((prev) => [...prev, data.project]);
          setActiveProjectId(data.project.id);
        }
      } catch {
        // ignore
      }
    },
    []
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      // Stop daemon for this project
      fetch("/api/daemon/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      }).catch(() => {});

      // Delete from API
      fetch(`/api/projects/${id}`, { method: "DELETE" }).catch(() => {});

      setProjects((prev) => prev.filter((p) => p.id !== id));
      setConversations((prev) => prev.filter((c) => c.projectId !== id));
      setConnectedProjectIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (id === activeProjectId) {
        setActiveProjectId(null);
        setMessages([]);
        setActiveConversationId(null);
      }
    },
    [activeProjectId]
  );

  const handleSelectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setProjectsOpen(false);
    setMessages([]);
    setActiveConversationId(null);
    setCurrentActivity(null);
    setSessionActivated(false);
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      const userMessage: Message = {
        id: uuidv4(),
        role: "user",
        content,
        timestamp: Date.now(),
        type: "text",
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
      setCurrentActivity({
        type: "status",
        message: "Sending to Claude...",
      });

      if (connectionStatus.daemon === "connected") {
        const activeConvo = conversations.find(
          (c) => c.id === activeConversationId
        );
        socketSendMessage(content, activeConvo?.sessionId);
      } else {
        setIsTyping(false);
        setCurrentActivity(null);
        const errorMsg: Message = {
          id: uuidv4(),
          role: "assistant",
          content:
            "Your computer's daemon isn't connected. Open Settings and activate a Claude session for your project.",
          timestamp: Date.now(),
          type: "error",
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [
      connectionStatus.daemon,
      socketSendMessage,
      conversations,
      activeConversationId,
    ]
  );

  const handlePermission = useCallback(
    (id: string, approved: boolean) => {
      sendPermissionResponse(id, approved);

      const statusMsg: Message = {
        id: uuidv4(),
        role: "system",
        content: approved
          ? "Permission granted. Claude is working..."
          : "Permission denied. Claude will find another approach.",
        timestamp: Date.now(),
        type: "status",
      };
      setMessages((prev) => [...prev, statusMsg]);

      if (approved) {
        setIsTyping(true);
      }
    },
    [sendPermissionResponse]
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    setCurrentActivity(null);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    const convo = conversations.find((c) => c.id === id);
    if (convo) {
      setMessages(convo.messages);
      setActiveConversationId(id);
      setCurrentActivity(null);
      if (convo.projectId) {
        setActiveProjectId(convo.projectId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeConversationId) {
        setMessages([]);
        setActiveConversationId(null);
      }
    },
    [activeConversationId]
  );

  const handleDangerousModeChange = useCallback((value: boolean) => {
    setDangerousMode(value);
    fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dangerousMode: value }),
    }).catch(() => {});
  }, []);

  // Filter conversations for current project
  const filteredConversations = activeProjectId
    ? conversations.filter(
        (c) => c.projectId === activeProjectId || !c.projectId
      )
    : conversations;

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-background">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Header
        connectionStatus={connectionStatus}
        onNewChat={handleNewChat}
        onSettings={() => setSettingsOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onProjects={() => setProjectsOpen(true)}
        activeProjectName={activeProject?.name}
        sessionActive={sessionActivated}
        dangerousMode={dangerousMode}
        userEmail={user?.email}
        onLogout={logout}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onPermission={handlePermission}
              />
            ))}
            {isTyping && <TypingIndicator activity={currentActivity} />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={handleSend}
            placeholder={
              connectionStatus.daemon === "connected"
                ? "Send a command to Claude Code..."
                : activeProject
                ? "Activate session in Settings..."
                : "Add a project first..."
            }
          />
        </div>
      </div>

      {/* Project Sidebar */}
      <ProjectSidebar
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        connectedProjectIds={connectedProjectIds}
        onSelect={handleSelectProject}
        onAdd={handleAddProject}
        onDelete={handleDeleteProject}
      />

      {/* Conversation History Sidebar */}
      <ConversationSidebar
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={filteredConversations}
        activeConversationId={activeConversationId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        pairingCode={pairingCode}
        activeProject={activeProject}
        daemonConnected={connectionStatus.daemon === "connected"}
        onDaemonChanged={refreshDaemonStatus}
        dangerousMode={dangerousMode}
        onDangerousModeChange={handleDangerousModeChange}
        userEmail={user?.email}
        onLogout={logout}
      />
    </div>
  );
}
