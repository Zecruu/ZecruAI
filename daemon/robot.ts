#!/usr/bin/env node
/**
 * ZecruAI Robot Daemon
 *
 * Always-on daemon that handles ALL projects through a single connection.
 * Supports: multi-project Claude Code sessions, file browsing, terminal
 * commands, workspace scanning, and project creation.
 */

import { io, Socket } from "socket.io-client";
import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";

const RELAY_URL = process.env.RELAY_URL || "http://localhost:3000";

function getClaudeCLI(): string {
  const root = process.env.ELECTRON_APP_ROOT || process.cwd();
  return path.join(root, "node_modules", "@anthropic-ai", "claude-code", "cli.js");
}

function parseArgs(): { pairingCode: string; dangerousMode: boolean } {
  const args = process.argv.slice(2);
  let pairingCode = "";
  let dangerousMode = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--code" || args[i] === "-c") && args[i + 1]) {
      pairingCode = args[i + 1];
      i++;
    } else if (args[i] === "--dangerous") {
      dangerousMode = true;
    }
  }

  return { pairingCode, dangerousMode };
}

// --- Utility functions ---

function shortenPath(filePath: string | undefined): string {
  if (!filePath) return "file";
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.length <= 2) return filePath;
  return `.../${parts.slice(-2).join("/")}`;
}

function truncate(text: string | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? text.substring(0, max) + "..." : text;
}

function describeToolUse(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read": return `Reading ${shortenPath(input.file_path as string)}`;
    case "Write": return `Writing ${shortenPath(input.file_path as string)}`;
    case "Edit": return `Editing ${shortenPath(input.file_path as string)}`;
    case "Bash": return `Running: ${truncate(input.command as string, 60)}`;
    case "Glob": return `Searching files: ${input.pattern}`;
    case "Grep": return `Searching code: ${truncate(input.pattern as string, 40)}`;
    case "Task": return `Running sub-task`;
    case "WebSearch": return `Searching web: ${truncate(input.query as string, 40)}`;
    case "WebFetch": return `Fetching: ${truncate(input.url as string, 50)}`;
    default: return `Using ${toolName}`;
  }
}

// --- Claude Code Bridge (per-project) ---

class ClaudeCodeBridge {
  private process: ChildProcess | null = null;
  private socket: Socket;
  private workingDir: string;
  private conversationId: string | null = null;
  private lineBuffer: string = "";
  private dangerousMode: boolean;

  constructor(socket: Socket, workingDir: string, dangerousMode: boolean = false) {
    this.socket = socket;
    this.workingDir = workingDir;
    this.dangerousMode = dangerousMode;
  }

  sendMessage(content: string, sessionId?: string, autoApprove?: boolean) {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }

    this.lineBuffer = "";
    const args: string[] = ["--print", "--verbose", "--output-format", "stream-json"];

    if (this.dangerousMode || autoApprove) {
      args.push("--dangerously-skip-permissions");
    }

    const resumeId = sessionId || this.conversationId;
    if (resumeId) {
      args.push("--resume", resumeId);
    }

    args.push(content);

    const cliPath = getClaudeCLI();
    console.log(`\n  [send:${shortenPath(this.workingDir)}] "${truncate(content, 60)}"`);

    const cleanEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (val === undefined) continue;
      if (key.startsWith("CLAUDE")) continue;
      if (key.startsWith("MCP")) continue;
      cleanEnv[key] = val;
    }

    this.process = spawn(process.execPath, [cliPath, ...args], {
      cwd: this.workingDir,
      shell: false,
      env: cleanEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let gotAnyOutput = false;

    this.socket.emit("daemon:activity", { type: "status", message: "Claude is thinking..." });

    this.process.stdout?.on("data", (data: Buffer) => {
      gotAnyOutput = true;
      this.lineBuffer += data.toString();
      const lines = this.lineBuffer.split("\n");
      this.lineBuffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.processStreamLine(trimmed);
      }
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      console.log(`  [err]  ${data.toString().substring(0, 200)}`);
    });

    this.process.on("close", (code) => {
      if (this.lineBuffer.trim()) {
        this.processStreamLine(this.lineBuffer.trim());
        this.lineBuffer = "";
      }
      console.log(`  [done] exit code ${code}`);
      if (!gotAnyOutput && code !== 0) {
        this.socket.emit("daemon:response", {
          content: `Claude Code exited with code ${code}. Make sure you're logged in — run 'claude' in a terminal once to authenticate.`,
          type: "error", done: true,
        });
      } else {
        this.socket.emit("daemon:response", { content: "", type: "text", done: true });
      }
      this.process = null;
    });

    this.process.on("error", (err) => {
      console.error(`  [error] ${err.message}`);
      this.socket.emit("daemon:response", {
        content: `Error starting Claude Code: ${err.message}`,
        type: "error", done: true,
      });
      this.process = null;
    });
  }

  private processStreamLine(line: string) {
    let event: Record<string, unknown>;
    try { event = JSON.parse(line); } catch { return; }

    const eventType = event.type as string;

    switch (eventType) {
      case "assistant": {
        const message = event.message as Record<string, unknown> | undefined;
        const contentBlocks = (message?.content || []) as Array<Record<string, unknown>>;
        if (event.session_id) this.conversationId = event.session_id as string;

        for (const block of contentBlocks) {
          if (block.type === "text" && block.text) {
            this.socket.emit("daemon:response", { content: block.text, type: "text", done: false });
          } else if (block.type === "tool_use") {
            const description = describeToolUse(block.name as string, (block.input || {}) as Record<string, unknown>);
            this.socket.emit("daemon:activity", { type: "tool_use", tool: block.name, message: description, input: block.input });
          }
        }
        break;
      }
      case "progress":
        this.socket.emit("daemon:activity", { type: "progress", message: "Working..." });
        break;
      case "result": {
        const sessionId = event.session_id as string;
        if (sessionId) this.conversationId = sessionId;
        const resultText = event.result as string;
        if (resultText) {
          this.socket.emit("daemon:result", {
            text: resultText,
            isError: event.is_error || false,
            costUsd: event.total_cost_usd || 0,
            durationMs: event.duration_ms || 0,
            sessionId: sessionId || null,
          });
        }
        break;
      }
    }
  }

  kill() {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}

// --- Robot Daemon: Multi-project orchestrator ---

class RobotDaemon {
  private socket: Socket;
  private bridges: Map<string, ClaudeCodeBridge> = new Map();
  private dangerousMode: boolean;
  private runningCommands: Map<string, ChildProcess> = new Map();

  constructor(socket: Socket, dangerousMode: boolean) {
    this.socket = socket;
    this.dangerousMode = dangerousMode;
  }

  private getBridge(workingDir: string): ClaudeCodeBridge {
    const key = path.resolve(workingDir);
    if (!this.bridges.has(key)) {
      this.bridges.set(key, new ClaudeCodeBridge(this.socket, key, this.dangerousMode));
    }
    return this.bridges.get(key)!;
  }

  // --- Claude Code message (per-project via workingDir) ---
  handleMessage(data: { content: string; workingDir?: string; conversationId?: string; autoApprove?: boolean }) {
    const workingDir = data.workingDir || process.cwd();
    console.log(`\n  ━━━ Message for ${shortenPath(workingDir)} ━━━`);
    const bridge = this.getBridge(workingDir);
    bridge.sendMessage(data.content, data.conversationId, data.autoApprove);
  }

  // --- Workspace scanning ---
  async handleScanWorkspace(data: { rootPath: string }, callback: (result: unknown) => void) {
    const rootPath = path.resolve(data.rootPath);
    console.log(`  [scan] Scanning workspace: ${rootPath}`);

    const projects: Array<{ name: string; path: string; indicators: string[]; framework?: string }> = [];
    const markers = ["package.json", ".git", "Cargo.toml", "go.mod", "pom.xml", "pyproject.toml", "requirements.txt", "Gemfile"];

    try {
      const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

        const dirPath = path.join(rootPath, entry.name);
        const indicators: string[] = [];

        for (const marker of markers) {
          try {
            await fs.promises.access(path.join(dirPath, marker));
            indicators.push(marker);
          } catch { /* doesn't exist */ }
        }

        if (indicators.length > 0) {
          let framework: string | undefined;
          // Detect framework from package.json
          if (indicators.includes("package.json")) {
            try {
              const pkg = JSON.parse(await fs.promises.readFile(path.join(dirPath, "package.json"), "utf-8"));
              const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
              if (allDeps["next"]) framework = "Next.js";
              else if (allDeps["@angular/core"]) framework = "Angular";
              else if (allDeps["vue"]) framework = "Vue";
              else if (allDeps["svelte"]) framework = "Svelte";
              else if (allDeps["react"]) framework = "React";
              else if (allDeps["express"]) framework = "Express";
            } catch { /* ignore */ }
          }

          projects.push({ name: entry.name, path: dirPath, indicators, framework });
        }
      }
    } catch (err: unknown) {
      console.error(`  [scan] Error: ${err instanceof Error ? err.message : "unknown"}`);
    }

    console.log(`  [scan] Found ${projects.length} projects`);
    callback({ projects, rootPath, scannedAt: Date.now() });
  }

  // --- File browsing ---
  async handleBrowseFiles(data: { path: string; depth?: number }, callback: (result: unknown) => void) {
    const targetPath = path.resolve(data.path);

    try {
      const dirEntries = await fs.promises.readdir(targetPath, { withFileTypes: true });
      const entries: Array<{ name: string; path: string; type: string; size?: number; modified?: number; extension?: string }> = [];

      for (const entry of dirEntries) {
        if (entry.name.startsWith(".") && entry.name !== ".env" && entry.name !== ".gitignore") continue;
        if (entry.name === "node_modules" || entry.name === ".git") continue;

        const fullPath = path.join(targetPath, entry.name);
        let size: number | undefined;
        let modified: number | undefined;

        try {
          const stat = await fs.promises.stat(fullPath);
          size = stat.isFile() ? stat.size : undefined;
          modified = stat.mtimeMs;
        } catch { /* skip stat errors */ }

        entries.push({
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
          size,
          modified,
          extension: entry.isFile() ? path.extname(entry.name) : undefined,
        });
      }

      // Sort: directories first, then files, both alphabetical
      entries.sort((a, b) => {
        if (a.type === "directory" && b.type !== "directory") return -1;
        if (a.type !== "directory" && b.type === "directory") return 1;
        return a.name.localeCompare(b.name);
      });

      callback({ path: targetPath, entries });
    } catch (err: unknown) {
      callback({ path: targetPath, entries: [], error: err instanceof Error ? err.message : "unknown" });
    }
  }

  // --- Terminal command execution ---
  handleRunCommand(data: { command: string; workingDir: string; id: string }) {
    const workingDir = path.resolve(data.workingDir);
    console.log(`  [cmd:${data.id}] ${data.command} (in ${shortenPath(workingDir)})`);

    const startTime = Date.now();
    const proc = spawn(data.command, [], {
      cwd: workingDir,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.runningCommands.set(data.id, proc);

    proc.stdout?.on("data", (chunk: Buffer) => {
      this.socket.emit("daemon:command-output", {
        id: data.id,
        data: chunk.toString(),
        stream: "stdout",
      });
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      this.socket.emit("daemon:command-output", {
        id: data.id,
        data: chunk.toString(),
        stream: "stderr",
      });
    });

    proc.on("close", (exitCode) => {
      this.runningCommands.delete(data.id);
      this.socket.emit("daemon:command-done", {
        id: data.id,
        exitCode,
        durationMs: Date.now() - startTime,
      });
    });

    proc.on("error", (err) => {
      this.runningCommands.delete(data.id);
      this.socket.emit("daemon:command-output", {
        id: data.id,
        data: `Error: ${err.message}\n`,
        stream: "stderr",
      });
      this.socket.emit("daemon:command-done", {
        id: data.id,
        exitCode: 1,
        durationMs: Date.now() - startTime,
      });
    });
  }

  // --- Project creation ---
  async handleCreateProject(data: { path: string; name: string; template?: string }, callback: (result: unknown) => void) {
    const projectPath = path.resolve(data.path);
    console.log(`  [create] ${data.name} at ${projectPath}`);

    try {
      await fs.promises.mkdir(projectPath, { recursive: true });
      callback({ path: projectPath, name: data.name, success: true });
    } catch (err: unknown) {
      callback({ path: projectPath, name: data.name, success: false, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  // --- Project context query (for overseer) ---
  async handleQueryContext(data: { workingDir?: string }, callback: (result: unknown) => void) {
    const workingDir = data.workingDir ? path.resolve(data.workingDir) : process.cwd();
    const context: Record<string, unknown> = {
      envKeys: [] as string[],
      dependencies: {},
      devDependencies: {},
      scripts: {},
      configFiles: [] as string[],
    };

    try {
      const envKeys: string[] = [];
      for (const envFile of [".env", ".env.local", ".env.development"]) {
        try {
          const content = fs.readFileSync(path.join(workingDir, envFile), "utf-8");
          const keys = content.split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("=")[0].trim()).filter(Boolean);
          envKeys.push(...keys);
        } catch { /* doesn't exist */ }
      }
      context.envKeys = [...new Set(envKeys)];

      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(workingDir, "package.json"), "utf-8"));
        context.dependencies = pkg.dependencies || {};
        context.devDependencies = pkg.devDependencies || {};
        context.scripts = pkg.scripts || {};
      } catch { /* no package.json */ }

      const configFiles: string[] = [];
      for (const cfg of ["Dockerfile", "docker-compose.yml", "tsconfig.json", "next.config.js", "next.config.mjs", "next.config.ts", "vite.config.ts", "tailwind.config.ts", "prisma/schema.prisma"]) {
        try { fs.accessSync(path.join(workingDir, cfg)); configFiles.push(cfg); } catch { /* doesn't exist */ }
      }
      context.configFiles = configFiles;
    } catch { /* ignore */ }

    callback(context);
  }

  killAll() {
    for (const [, bridge] of this.bridges) bridge.kill();
    for (const [, proc] of this.runningCommands) proc.kill("SIGTERM");
    this.bridges.clear();
    this.runningCommands.clear();
  }
}

// --- Main ---

async function main() {
  let { pairingCode, dangerousMode } = parseArgs();

  if (!pairingCode) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`
  ┌─────────────────────────────────────┐
  │        ZecruAI Robot Daemon         │
  │      Always-On Agent Bridge         │
  └─────────────────────────────────────┘
    `);
    pairingCode = await new Promise<string>((resolve) => {
      rl.question("  Enter pairing code: ", (answer) => { resolve(answer.trim().toUpperCase()); rl.close(); });
    });
  }

  if (!pairingCode) {
    console.error("\n  Error: Pairing code is required.\n");
    process.exit(1);
  }

  console.log(`
  ┌─────────────────────────────────────┐
  │        ZecruAI Robot Daemon         │
  │      Always-On Agent Bridge         │
  └─────────────────────────────────────┘

  Pairing Code:  ${pairingCode}
  Relay Server:  ${RELAY_URL}
  Mode:          ROBOT (multi-project)${dangerousMode ? "\n  Permissions:   AUTO-APPROVE (dangerous)" : ""}
  `);

  console.log("  Connecting to relay server...");

  const socket = io(RELAY_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  const robot = new RobotDaemon(socket, dangerousMode);

  socket.on("connect", () => {
    console.log("  Connected to relay server!");
    socket.emit("daemon:register", { pairingCode, mode: "robot" });
  });

  socket.on("daemon:registered", (data: { success: boolean }) => {
    if (data.success) {
      console.log("  Robot registered! Waiting for commands...");
      console.log("  ─────────────────────────────────────");
    }
  });

  // Claude Code messages (with per-message workingDir)
  socket.on("daemon:message", (data: { content: string; workingDir?: string; conversationId?: string; autoApprove?: boolean; from: string }) => {
    robot.handleMessage(data);
  });

  // Workspace scanning
  socket.on("daemon:scan-workspace", (data: { rootPath: string }, callback: (result: unknown) => void) => {
    robot.handleScanWorkspace(data, callback);
  });

  // File browsing
  socket.on("daemon:browse-files", (data: { path: string; depth?: number }, callback: (result: unknown) => void) => {
    robot.handleBrowseFiles(data, callback);
  });

  // Terminal commands
  socket.on("daemon:run-command", (data: { command: string; workingDir: string; id: string }) => {
    robot.handleRunCommand(data);
  });

  // Project creation
  socket.on("daemon:create-project", (data: { path: string; name: string; template?: string }, callback: (result: unknown) => void) => {
    robot.handleCreateProject(data, callback);
  });

  // Project context query (for overseer)
  socket.on("daemon:query-context", (data: { workingDir?: string }, callback: (result: unknown) => void) => {
    robot.handleQueryContext(data, callback);
  });

  // Permission responses (no-op with stdin: ignore)
  socket.on("daemon:permission_response", () => {});

  socket.on("disconnect", (reason) => {
    console.log(`\n  Disconnected: ${reason}. Reconnecting...`);
  });

  socket.on("connect_error", (err) => {
    console.error(`  Connection error: ${err.message}`);
  });

  const shutdown = () => {
    console.log("\n  Shutting down robot daemon...");
    robot.killAll();
    socket.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(`\n  Fatal error: ${err.message}\n`);
  process.exit(1);
});
