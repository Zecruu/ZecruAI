#!/usr/bin/env node
/**
 * ZecruAI Local Daemon
 *
 * Runs on the user's computer. Connects to the relay server and bridges
 * messages between the web app and Claude Code CLI.
 *
 * Uses the bundled @anthropic-ai/claude-code npm package's cli.js.
 * Authentication is shared — users just need to run `claude` once
 * in a terminal to log in, and ZecruAI picks up those credentials.
 */

import { io, Socket } from "socket.io-client";
import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";

// --- Configuration ---
const RELAY_URL = process.env.RELAY_URL || "http://localhost:3000";

/**
 * Get the path to the bundled Claude Code CLI.
 * Uses the npm package installed in the zecru-ai project.
 */
function getClaudeCLI(): string {
  const root = process.env.ELECTRON_APP_ROOT || process.cwd();
  return path.join(root, "node_modules", "@anthropic-ai", "claude-code", "cli.js");
}

function parseArgs(): { pairingCode: string; workingDir: string; dangerousMode: boolean } {
  const args = process.argv.slice(2);
  let pairingCode = "";
  let workingDir = process.cwd();
  let dangerousMode = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--code" || args[i] === "-c") && args[i + 1]) {
      pairingCode = args[i + 1];
      i++;
    } else if ((args[i] === "--dir" || args[i] === "-d") && args[i + 1]) {
      workingDir = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--dangerous") {
      dangerousMode = true;
    }
  }

  return { pairingCode, workingDir, dangerousMode };
}

// --- Describe tool use in human-readable form ---
function describeToolUse(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read":
      return `Reading ${shortenPath(input.file_path as string)}`;
    case "Write":
      return `Writing ${shortenPath(input.file_path as string)}`;
    case "Edit":
      return `Editing ${shortenPath(input.file_path as string)}`;
    case "Bash":
      return `Running: ${truncate(input.command as string, 60)}`;
    case "Glob":
      return `Searching files: ${input.pattern}`;
    case "Grep":
      return `Searching code: ${truncate(input.pattern as string, 40)}`;
    case "Task":
      return `Running sub-task`;
    case "WebSearch":
      return `Searching web: ${truncate(input.query as string, 40)}`;
    case "WebFetch":
      return `Fetching: ${truncate(input.url as string, 50)}`;
    default:
      return `Using ${toolName}`;
  }
}

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

// --- Claude Code Process Manager ---
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

  /**
   * Send a message to Claude Code CLI.
   *
   * Uses: node cli.js --print --verbose --output-format stream-json
   * with stdio: ['ignore', 'pipe', 'pipe']
   *
   * IMPORTANT: stdin MUST be 'ignore' — Claude Code hangs when
   * stdin is a pipe on Windows.
   */
  sendMessage(content: string, sessionId?: string, autoApprove?: boolean) {
    // Kill any existing process (one message at a time)
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }

    this.lineBuffer = "";

    const args: string[] = [];
    args.push("--print");
    args.push("--verbose");
    args.push("--output-format", "stream-json");

    if (this.dangerousMode || autoApprove) {
      args.push("--dangerously-skip-permissions");
    }

    // Use sessionId from web app (persisted in localStorage) or in-memory fallback
    const resumeId = sessionId || this.conversationId;
    if (resumeId) {
      args.push("--resume", resumeId);
    }

    args.push(content);

    const cliPath = getClaudeCLI();
    console.log(`\n  [send] "${content.substring(0, 60)}${content.length > 60 ? "..." : ""}"`);

    // Build a clean env — strip Claude Code session vars
    const cleanEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (val === undefined) continue;
      if (key.startsWith("CLAUDE")) continue;
      if (key.startsWith("MCP")) continue;
      cleanEnv[key] = val;
    }

    // Spawn: node cli.js with stdin IGNORED (critical for Windows)
    this.process = spawn(process.execPath, [cliPath, ...args], {
      cwd: this.workingDir,
      shell: false,
      env: cleanEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let gotAnyOutput = false;

    this.socket.emit("daemon:activity", {
      type: "status",
      message: "Claude is thinking...",
    });

    // Stream stdout — NDJSON lines
    this.process.stdout?.on("data", (data: Buffer) => {
      gotAnyOutput = true;
      const text = data.toString();
      this.lineBuffer += text;

      const lines = this.lineBuffer.split("\n");
      this.lineBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.processStreamLine(trimmed);
      }
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      console.log(`  [err]  ${text.substring(0, 200)}`);
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
          type: "error",
          done: true,
        });
      } else {
        this.socket.emit("daemon:response", {
          content: "",
          type: "text",
          done: true,
        });
      }

      this.process = null;
    });

    this.process.on("error", (err) => {
      console.error(`  [error] ${err.message}`);
      this.socket.emit("daemon:response", {
        content: `Error starting Claude Code: ${err.message}`,
        type: "error",
        done: true,
      });
      this.process = null;
    });
  }

  private processStreamLine(line: string) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      console.log(`  [parse-skip] ${line.substring(0, 80)}`);
      return;
    }

    const eventType = event.type as string;

    switch (eventType) {
      case "assistant": {
        const message = event.message as Record<string, unknown> | undefined;
        const contentBlocks = (message?.content || []) as Array<Record<string, unknown>>;

        if (event.session_id) {
          this.conversationId = event.session_id as string;
        }

        for (const block of contentBlocks) {
          if (block.type === "text") {
            const text = block.text as string;
            if (text) {
              console.log(`  [text] ${text.substring(0, 80)}`);
              this.socket.emit("daemon:response", {
                content: text,
                type: "text",
                done: false,
              });
            }
          } else if (block.type === "tool_use") {
            const toolName = block.name as string;
            const input = (block.input || {}) as Record<string, unknown>;
            const description = describeToolUse(toolName, input);
            console.log(`  [tool] ${description}`);
            this.socket.emit("daemon:activity", {
              type: "tool_use",
              tool: toolName,
              message: description,
              input,
            });
          }
        }
        break;
      }

      case "progress": {
        this.socket.emit("daemon:activity", {
          type: "progress",
          message: "Working...",
        });
        break;
      }

      case "system": {
        const subtype = event.subtype as string;
        console.log(`  [system] ${subtype || "unknown"}`);
        break;
      }

      case "result": {
        const resultText = event.result as string;
        const isError = event.is_error as boolean;
        const costUsd = event.total_cost_usd as number;
        const durationMs = event.duration_ms as number;
        const sessionId = event.session_id as string;

        if (sessionId) {
          this.conversationId = sessionId;
        }

        console.log(`  [result] ${isError ? "ERROR" : "OK"} cost=$${costUsd?.toFixed(4) || "?"} duration=${durationMs || "?"}ms`);

        if (resultText) {
          this.socket.emit("daemon:result", {
            text: resultText,
            isError: isError || false,
            costUsd: costUsd || 0,
            durationMs: durationMs || 0,
            sessionId: sessionId || null,
          });
        }
        break;
      }

      default:
        console.log(`  [event:${eventType}] ${JSON.stringify(event).substring(0, 100)}`);
        break;
    }
  }

  sendPermissionResponse(approved: boolean) {
    // Note: with stdin ignored, we can't write to stdin for permissions.
    // In --print mode with auto-approve, this isn't needed.
    console.log(`  [perm] ${approved ? "APPROVED" : "DENIED"} (auto-approved in --print mode)`);
  }

  kill() {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}

// --- Pretty Print ---
function banner(code: string, dir: string, dangerous: boolean) {
  console.log(`
  ┌─────────────────────────────────────┐
  │           ZecruAI Daemon            │
  │     Remote Claude Code Bridge       │
  └─────────────────────────────────────┘

  Pairing Code:  ${code}
  Project Dir:   ${dir}
  Relay Server:  ${RELAY_URL}${dangerous ? "\n  Mode:         AUTO-APPROVE (dangerous)" : ""}
  `);
}

// --- Main ---
async function main() {
  let { pairingCode, workingDir, dangerousMode } = parseArgs();

  if (!pairingCode) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`
  ┌─────────────────────────────────────┐
  │           ZecruAI Daemon            │
  │     Remote Claude Code Bridge       │
  └─────────────────────────────────────┘
    `);

    pairingCode = await new Promise<string>((resolve) => {
      rl.question("  Enter pairing code from your phone: ", (answer) => {
        resolve(answer.trim().toUpperCase());
      });
    });

    const dirAnswer = await new Promise<string>((resolve) => {
      rl.question(`  Project directory [${workingDir}]: `, (answer) => {
        resolve(answer.trim() || workingDir);
        rl.close();
      });
    });

    workingDir = path.resolve(dirAnswer);
  }

  if (!pairingCode) {
    console.error("\n  Error: Pairing code is required.\n");
    process.exit(1);
  }

  banner(pairingCode, workingDir, dangerousMode);

  console.log("  Connecting to relay server...");

  const socket = io(RELAY_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  const bridge = new ClaudeCodeBridge(socket, workingDir, dangerousMode);

  socket.on("connect", () => {
    console.log("  Connected to relay server!");
    socket.emit("daemon:register", {
      pairingCode,
      workingDir,
    });
  });

  socket.on("daemon:registered", (data: { success: boolean }) => {
    if (data.success) {
      console.log("  Registered! Waiting for messages...");
      console.log("  ─────────────────────────────────────");
    }
  });

  socket.on(
    "daemon:message",
    (data: { content: string; conversationId?: string; autoApprove?: boolean; from: string }) => {
      console.log(`\n  ━━━ New message from web app ━━━${data.autoApprove ? " [overseer: auto-approve]" : ""}`);
      bridge.sendMessage(data.content, data.conversationId, data.autoApprove);
    }
  );

  socket.on(
    "daemon:permission_response",
    (data: { id: string; approved: boolean }) => {
      bridge.sendPermissionResponse(data.approved);
    }
  );

  // Overseer: query project context from filesystem
  socket.on("daemon:query-context", (_data: unknown, callback: (response: Record<string, unknown>) => void) => {
    console.log("  [context] Gathering project context...");

    const context: Record<string, unknown> = {
      envKeys: [] as string[],
      dependencies: {} as Record<string, string>,
      devDependencies: {} as Record<string, string>,
      scripts: {} as Record<string, string>,
      configFiles: [] as string[],
    };

    try {
      // Read .env file keys (NOT values)
      const envKeys: string[] = [];
      for (const envFile of [".env", ".env.local", ".env.development"]) {
        try {
          const content = fs.readFileSync(path.join(workingDir, envFile), "utf-8");
          const keys = content
            .split("\n")
            .filter((line) => line.trim() && !line.startsWith("#"))
            .map((line) => line.split("=")[0].trim())
            .filter(Boolean);
          envKeys.push(...keys);
        } catch {
          // file doesn't exist
        }
      }
      context.envKeys = [...new Set(envKeys)];

      // Read package.json
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(workingDir, "package.json"), "utf-8"));
        context.dependencies = pkg.dependencies || {};
        context.devDependencies = pkg.devDependencies || {};
        context.scripts = pkg.scripts || {};
      } catch {
        // no package.json
      }

      // Check for key config files
      const configFiles: string[] = [];
      const checks = [
        "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
        "tsconfig.json", ".eslintrc.json", ".prettierrc",
        "next.config.js", "next.config.mjs", "next.config.ts",
        "vite.config.ts", "tailwind.config.ts", "tailwind.config.js",
        "prisma/schema.prisma",
      ];
      for (const cfg of checks) {
        try {
          fs.accessSync(path.join(workingDir, cfg));
          configFiles.push(cfg);
        } catch {
          // doesn't exist
        }
      }
      context.configFiles = configFiles;
    } catch (err: unknown) {
      console.error(`  [context] Error: ${err instanceof Error ? err.message : "unknown"}`);
    }

    console.log(`  [context] Found: ${(context.envKeys as string[]).length} env keys, ${Object.keys(context.dependencies as object).length} deps, ${(context.configFiles as string[]).length} config files`);
    callback(context);
  });

  socket.on("disconnect", (reason) => {
    console.log(`\n  Disconnected: ${reason}. Reconnecting...`);
  });

  socket.on("connect_error", (err) => {
    console.error(`  Connection error: ${err.message}`);
    console.error(`  Is the relay server running? (npm run relay)`);
  });

  const shutdown = () => {
    console.log("\n  Shutting down daemon...");
    bridge.kill();
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
