export type TabMode = "developer" | "ui";

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
  source?: "manual" | "scanned";
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
  hasRailwayToken?: boolean;
  hasVercelToken?: boolean;
  hasAnthropicKey?: boolean;
  overseerEnabled?: boolean;
  workspaceRoot?: string;
}

export interface ProjectContext {
  envKeys: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  configFiles: string[];
}

export interface PrerequisiteItem {
  type: "env_var" | "dependency" | "config_file" | "other";
  name: string;
  reason: string;
}

export interface OverseerDecision {
  autoApprove: boolean;
  reasoning: string;
  prerequisites?: PrerequisiteItem[];
}

export interface OverseerFollowUp {
  action: "none" | "follow_up";
  followUpMessage?: string;
  reasoning: string;
}

// === Deployment Types ===

export type DeploymentProvider = "railway" | "vercel";
export type DeploymentStatus = "creating" | "building" | "deploying" | "ready" | "error";

export interface Deployment {
  id: string;
  projectId: string;
  provider: DeploymentProvider;
  providerProjectId: string;
  providerServiceId?: string;
  providerEnvironmentId?: string;
  githubRepo?: string;
  status: DeploymentStatus;
  url?: string;
  providerDeploymentId?: string;
  lastDeployedAt?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// === Zecru UI Builder Types ===

export type UIElementType =
  | "container"
  | "section"
  | "navbar"
  | "hero"
  | "card"
  | "button"
  | "text"
  | "heading"
  | "image"
  | "footer"
  | "form"
  | "input"
  | "divider";

export interface UIElementStyle {
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  padding?: number;
  opacity?: number;
  display?: "block" | "flex";
  flexDirection?: "row" | "column";
  justifyContent?: string;
  alignItems?: string;
  gap?: number;
}

export interface UIElement {
  id: string;
  type: UIElementType;
  name: string;
  content?: string;
  src?: string;
  placeholder?: string;
  style: UIElementStyle;
  children: UIElement[];
  locked?: boolean;
}

export interface UIComponentTemplate {
  type: UIElementType;
  label: string;
  icon: string;
  defaultStyle: UIElementStyle;
  defaultContent?: string;
  defaultChildren?: UIElement[];
}
