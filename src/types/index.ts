export type TabMode = "developer";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  type?: "text" | "permission" | "diff" | "error" | "status" | "activity";
}

export interface PermissionRequest {
  id: string;
  action: string;
  description: string;
  files?: string[];
  status: "pending" | "approved" | "denied";
  timestamp: number;
}

export interface ConnectionStatus {
  daemon: "connected" | "disconnected" | "connecting";
  relay: "connected" | "disconnected" | "connecting";
}

export interface Conversation {
  id: string;
  title: string;
  summary?: string;
  mode: TabMode;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  sessionId?: string;
  projectId?: string;
}

export interface Project {
  id: string;
  name: string;
  workingDirectory: string;
  createdAt: number;
}

export interface DaemonConfig {
  pairingCode: string;
  workingDirectory?: string;
  relayUrl: string;
}

export interface ActivityEvent {
  type: "tool_use" | "progress" | "status";
  tool?: string;
  message: string;
  input?: Record<string, unknown>;
}

export interface ResultEvent {
  text: string;
  isError: boolean;
  tokens: number;
  durationMs: number;
  sessionId: string | null;
}

export interface User {
  id: string;
  email: string;
  pairingCode: string;
  dangerousMode: boolean;
  createdAt: number;
}
