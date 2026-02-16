"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  TabMode,
  Message,
  ConnectionStatus,
  ActivityEvent,
  ResultEvent,
  Conversation,
  Project,
} from "@/types";
import { useSocket } from "@/hooks/useSocket";
import Header from "@/components/Header";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import EmptyState from "@/components/EmptyState";
import SettingsPanel from "@/components/SettingsPanel";
import ConversationSidebar from "@/components/ConversationSidebar";
import ProjectSidebar from "@/components/ProjectSidebar";

function generatePairingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// --- localStorage helpers ---
function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem("zecru-conversations");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]) {
  localStorage.setItem("zecru-conversations", JSON.stringify(convos));
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem("zecru-projects");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem("zecru-projects", JSON.stringify(projects));
}

function generateTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\n/g, " ").trim();
  return clean.length > 50 ? clean.substring(0, 50) + "..." : clean;
}

function generateSummary(assistantMessage: string): string {
  // Take the first meaningful line of the assistant's response
  const lines = assistantMessage.split("\n").filter((l) => l.trim());
  const firstLine = lines[0]?.trim() || "";
  return firstLine.length > 80
    ? firstLine.substring(0, 80) + "..."
    : firstLine;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabMode>("user");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [currentActivity, setCurrentActivity] = useState<ActivityEvent | null>(
    null
  );
  const [sessionActivated, setSessionActivated] = useState(false);
  const [dangerousMode, setDangerousMode] = useState(false);

  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [connectedProjectIds, setConnectedProjectIds] = useState<Set<string>>(
    new Set()
  );

  // Conversation history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive active project and effective pairing code for socket
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || null;

  // Local mode: include project ID for multi-project isolation
  // Remote mode: use base pairing code only (daemon connects with base code)
  const isLocal = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
     window.location.hostname === "127.0.0.1" ||
     window.location.hostname === "::1");
  const effectivePairingCode = isLocal && activeProjectId
    ? `${pairingCode}-${activeProjectId}`
    : pairingCode;

  // Refresh which daemons are running from the status API
  const refreshDaemonStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/daemon/status");
      const data = await res.json();
      if (data.daemons) {
        const ids = new Set<string>(
          Object.entries(data.daemons)
            .filter(([, d]: [string, any]) => d.running)
            .map(([id]) => id)
        );
        setConnectedProjectIds(ids);
      }
    } catch {
      // ignore
    }
  }, []);

  // Real WebSocket connection — uses effectivePairingCode so switching projects reconnects
  const {
    connectionStatus,
    sendMessage: socketSendMessage,
    sendPermissionResponse,
  } = useSocket({
    pairingCode: effectivePairingCode,
    onMessage: useCallback((msg: Message) => {
      setMessages((prev) => [...prev, msg]);
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
      // Show tool_use activities as inline status messages
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
        if (result.sessionId) {
          setConversations((prev) => {
            const updated = prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, sessionId: result.sessionId! }
                : c
            );
            saveConversations(updated);
            return updated;
          });
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

  // Load stored settings on mount
  useEffect(() => {
    const storedCode = localStorage.getItem("zecru-pairing-code");
    if (storedCode) {
      setPairingCode(storedCode);
    } else {
      const code = generatePairingCode();
      setPairingCode(code);
      localStorage.setItem("zecru-pairing-code", code);
    }

    setDangerousMode(localStorage.getItem("zecru-dangerous-mode") === "true");

    // Load projects
    const storedProjects = loadProjects();
    setProjects(storedProjects);

    const storedProjectId = localStorage.getItem("zecru-active-project-id");
    if (
      storedProjectId &&
      storedProjects.some((p) => p.id === storedProjectId)
    ) {
      setActiveProjectId(storedProjectId);
    }

    // Load conversations and restore last active
    const convos = loadConversations();
    setConversations(convos);

    const lastActiveId = localStorage.getItem("zecru-active-conversation");
    if (lastActiveId) {
      const lastConvo = convos.find((c) => c.id === lastActiveId);
      if (lastConvo) {
        setMessages(lastConvo.messages);
        setActiveConversationId(lastConvo.id);
        setActiveTab(lastConvo.mode);
      }
    }

    // Check daemon status
    refreshDaemonStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist active conversation ID
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem("zecru-active-conversation", activeConversationId);
    } else {
      localStorage.removeItem("zecru-active-conversation");
    }
  }, [activeConversationId]);

  // Persist active project ID
  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem("zecru-active-project-id", activeProjectId);
    } else {
      localStorage.removeItem("zecru-active-project-id");
    }
  }, [activeProjectId]);

  // Save current messages to active conversation whenever messages change
  useEffect(() => {
    if (activeTab !== "developer") return;
    if (messages.length === 0) return;

    setConversations((prev) => {
      let updated: Conversation[];

      if (activeConversationId) {
        // Update existing conversation — also fill in summary if missing
        updated = prev.map((c) => {
          if (c.id !== activeConversationId) return c;
          const patch: Partial<Conversation> = {
            messages,
            updatedAt: Date.now(),
          };
          if (!c.summary) {
            const firstAssistant = messages.find(
              (m) => m.role === "assistant" && m.type !== "error"
            );
            if (firstAssistant) {
              patch.summary = generateSummary(firstAssistant.content);
            }
          }
          return { ...c, ...patch };
        });
      } else {
        // Create new conversation from first user message
        const firstUserMsg = messages.find((m) => m.role === "user");
        if (!firstUserMsg) return prev;

        const firstAssistant = messages.find(
          (m) => m.role === "assistant" && m.type !== "error"
        );

        const newConvo: Conversation = {
          id: uuidv4(),
          title: generateTitle(firstUserMsg.content),
          summary: firstAssistant
            ? generateSummary(firstAssistant.content)
            : undefined,
          mode: "developer",
          messages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectId: activeProjectId || undefined,
        };
        setActiveConversationId(newConvo.id);
        updated = [...prev, newConvo];
      }

      saveConversations(updated);
      return updated;
    });
  }, [messages, activeTab, activeConversationId, activeProjectId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, currentActivity]);

  // --- Project handlers ---
  const handleAddProject = useCallback(
    (name: string, workingDirectory: string) => {
      const newProject: Project = {
        id: uuidv4(),
        name,
        workingDirectory,
        createdAt: Date.now(),
      };
      setProjects((prev) => {
        const updated = [...prev, newProject];
        saveProjects(updated);
        return updated;
      });
      setActiveProjectId(newProject.id);
    },
    []
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      // Stop daemon for this project
      fetch("/api/daemon/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      }).catch(() => {});

      setProjects((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        saveProjects(updated);
        return updated;
      });
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
    // Clear chat for new project context
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

      if (activeTab === "developer") {
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
      } else {
        setMessages((prev) => [...prev, userMessage]);
        setIsTyping(true);
        // User mode - placeholder
        setTimeout(() => {
          setIsTyping(false);
          const aiMessage: Message = {
            id: uuidv4(),
            role: "assistant",
            content: `I'd be happy to help with that! This is a demo response — once the Claude API is connected, I'll give you real answers.\n\nYou said: "${content}"`,
            timestamp: Date.now(),
            type: "text",
          };
          setMessages((prev) => [...prev, aiMessage]);
        }, 1200);
      }
    },
    [
      activeTab,
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
    const convo = loadConversations().find((c) => c.id === id);
    if (convo) {
      setMessages(convo.messages);
      setActiveConversationId(id);
      setActiveTab(convo.mode);
      setCurrentActivity(null);
      // Switch to the conversation's project if it has one
      if (convo.projectId) {
        setActiveProjectId(convo.projectId);
      }
    }
  }, []);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        saveConversations(updated);
        return updated;
      });
      if (id === activeConversationId) {
        setMessages([]);
        setActiveConversationId(null);
      }
    },
    [activeConversationId]
  );

  const handleRegenerateCode = useCallback(() => {
    const code = generatePairingCode();
    setPairingCode(code);
    localStorage.setItem("zecru-pairing-code", code);
  }, []);

  // Filter conversations for current project (show untagged ones too)
  const filteredConversations = activeProjectId
    ? conversations.filter(
        (c) => c.projectId === activeProjectId || !c.projectId
      )
    : conversations;

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connectionStatus={connectionStatus}
        onNewChat={handleNewChat}
        onSettings={() => setSettingsOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onProjects={() => setProjectsOpen(true)}
        activeProjectName={activeProject?.name}
        sessionActive={sessionActivated}
        dangerousMode={dangerousMode}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState mode={activeTab} />
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onPermission={
                  activeTab === "developer" ? handlePermission : undefined
                }
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
              activeTab === "developer"
                ? connectionStatus.daemon === "connected"
                  ? "Send a command to Claude Code..."
                  : activeProject
                  ? "Activate session in Settings..."
                  : "Add a project first..."
                : "Message ZecruAI..."
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
        onClose={() => {
          setSettingsOpen(false);
          setDangerousMode(
            localStorage.getItem("zecru-dangerous-mode") === "true"
          );
        }}
        pairingCode={pairingCode}
        onRegenerateCode={handleRegenerateCode}
        activeProject={activeProject}
        daemonConnected={connectionStatus.daemon === "connected"}
        onDaemonChanged={refreshDaemonStatus}
      />
    </div>
  );
}
