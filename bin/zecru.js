#!/usr/bin/env node
/**
 * ZecruAI CLI — Connect your computer to ZecruAI
 *
 * Usage:
 *   zecru connect <code>              Connect to a ZecruAI session
 *   zecru connect <code> --dir .      Specify project directory
 *   zecru connect <code> --dangerous  Auto-approve all actions
 *
 * The pairing code is shown in the ZecruAI web app under Settings.
 */

"use strict";

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

// ─── Relay URL ───────────────────────────────────────────────────────
const DEFAULT_RELAY = "https://www.zecruai.com";
const RELAY_URL = process.env.RELAY_URL || DEFAULT_RELAY;

// ─── Colors (no dependencies) ────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

// ─── CLI Argument Parsing ────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command === "version" || command === "--version" || command === "-v") {
    console.log("zecru-ai v0.1.0");
    process.exit(0);
  }

  if (command !== "connect") {
    console.error(`${c.red}Unknown command: ${command}${c.reset}`);
    console.error(`Run ${c.cyan}zecru help${c.reset} for usage.\n`);
    process.exit(1);
  }

  let pairingCode = "";
  let workingDir = process.cwd();
  let dangerousMode = false;
  let relay = RELAY_URL;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "--dir" || arg === "-d") && args[i + 1]) {
      workingDir = path.resolve(args[++i]);
    } else if ((arg === "--relay" || arg === "-r") && args[i + 1]) {
      relay = args[++i];
    } else if (arg === "--dangerous") {
      dangerousMode = true;
    } else if (!arg.startsWith("-") && !pairingCode) {
      pairingCode = arg.toUpperCase();
    }
  }

  if (!pairingCode) {
    console.error(`${c.red}Missing pairing code.${c.reset}`);
    console.error(`Usage: ${c.cyan}zecru connect <code>${c.reset}\n`);
    process.exit(1);
  }

  return { pairingCode, workingDir, dangerousMode, relay };
}

function printHelp() {
  console.log(`
${c.bold}${c.cyan}ZecruAI CLI${c.reset} — Connect your computer to ZecruAI

${c.bold}USAGE${c.reset}
  ${c.cyan}zecru connect <code>${c.reset}              Connect to a session
  ${c.cyan}zecru connect <code> --dir <path>${c.reset}  Specify project directory
  ${c.cyan}zecru connect <code> --dangerous${c.reset}   Auto-approve all actions

${c.bold}OPTIONS${c.reset}
  ${c.cyan}--dir, -d <path>${c.reset}     Project directory (default: current directory)
  ${c.cyan}--relay, -r <url>${c.reset}    Relay server URL (default: ${DEFAULT_RELAY})
  ${c.cyan}--dangerous${c.reset}          Skip permission prompts (use with caution)

${c.bold}EXAMPLES${c.reset}
  ${c.gray}# Connect from your project folder${c.reset}
  cd ~/my-project
  zecru connect ABC123

  ${c.gray}# Connect with explicit directory${c.reset}
  zecru connect ABC123 --dir ~/my-project

${c.bold}SETUP${c.reset}
  1. Open ${c.cyan}zecruai.com${c.reset} on your phone or browser
  2. Go to Settings and copy your pairing code
  3. Run ${c.cyan}zecru connect <code>${c.reset} on your computer

  Claude Code must be authenticated. Run ${c.cyan}claude${c.reset} once to log in.
`);
}

// ─── Tool Description ────────────────────────────────────────────────
function describeToolUse(toolName, input) {
  switch (toolName) {
    case "Read":
      return `Reading ${shortenPath(input.file_path)}`;
    case "Write":
      return `Writing ${shortenPath(input.file_path)}`;
    case "Edit":
      return `Editing ${shortenPath(input.file_path)}`;
    case "Bash":
      return `Running: ${truncate(input.command, 60)}`;
    case "Glob":
      return `Searching files: ${input.pattern}`;
    case "Grep":
      return `Searching code: ${truncate(input.pattern, 40)}`;
    case "Task":
      return `Running sub-task`;
    case "WebSearch":
      return `Searching web: ${truncate(input.query, 40)}`;
    case "WebFetch":
      return `Fetching: ${truncate(input.url, 50)}`;
    default:
      return `Using ${toolName}`;
  }
}

function shortenPath(filePath) {
  if (!filePath) return "file";
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.length <= 2) return filePath;
  return `.../${parts.slice(-2).join("/")}`;
}

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? text.substring(0, max) + "..." : text;
}

// ─── Claude Code CLI Path ────────────────────────────────────────────
function getClaudeCLI() {
  // Try local node_modules first (when running from the zecru-ai package)
  const localPath = path.join(__dirname, "..", "node_modules", "@anthropic-ai", "claude-code", "cli.js");
  try {
    require.resolve(localPath);
    return localPath;
  } catch {
    // Fall back to globally installed
    try {
      const resolved = require.resolve("@anthropic-ai/claude-code/cli.js");
      return resolved;
    } catch {
      return null;
    }
  }
}

// ─── Claude Code Bridge ─────────────────────────────────────────────
class ClaudeCodeBridge {
  constructor(socket, workingDir, dangerousMode) {
    this.process = null;
    this.socket = socket;
    this.workingDir = workingDir;
    this.dangerousMode = dangerousMode;
    this.conversationId = null;
    this.lineBuffer = "";
  }

  sendMessage(content, sessionId) {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }

    this.lineBuffer = "";

    const args = [];
    args.push("--print");
    args.push("--verbose");
    args.push("--output-format", "stream-json");

    if (this.dangerousMode) {
      args.push("--dangerously-skip-permissions");
    }

    const resumeId = sessionId || this.conversationId;
    if (resumeId) {
      args.push("--resume", resumeId);
    }

    args.push(content);

    const cliPath = getClaudeCLI();
    if (!cliPath) {
      this.socket.emit("daemon:response", {
        content: "Claude Code is not installed. Run: npm install -g @anthropic-ai/claude-code",
        type: "error",
        done: true,
      });
      return;
    }

    console.log(`\n  ${c.cyan}[send]${c.reset} "${truncate(content, 60)}"`);

    // Clean env — strip Claude Code session vars
    const cleanEnv = {};
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

    this.socket.emit("daemon:activity", {
      type: "status",
      message: "Claude is thinking...",
    });

    this.process.stdout.on("data", (data) => {
      gotAnyOutput = true;
      this.lineBuffer += data.toString();

      const lines = this.lineBuffer.split("\n");
      this.lineBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.processStreamLine(trimmed);
      }
    });

    this.process.stderr.on("data", (data) => {
      const text = data.toString();
      console.log(`  ${c.yellow}[err]${c.reset}  ${text.substring(0, 200)}`);
    });

    this.process.on("close", (code) => {
      if (this.lineBuffer.trim()) {
        this.processStreamLine(this.lineBuffer.trim());
        this.lineBuffer = "";
      }

      console.log(`  ${c.dim}[done] exit code ${code}${c.reset}`);

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
      console.error(`  ${c.red}[error]${c.reset} ${err.message}`);
      this.socket.emit("daemon:response", {
        content: `Error starting Claude Code: ${err.message}`,
        type: "error",
        done: true,
      });
      this.process = null;
    });
  }

  processStreamLine(line) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    const eventType = event.type;

    switch (eventType) {
      case "assistant": {
        const message = event.message || {};
        const contentBlocks = message.content || [];

        if (event.session_id) {
          this.conversationId = event.session_id;
        }

        for (const block of contentBlocks) {
          if (block.type === "text" && block.text) {
            console.log(`  ${c.green}[text]${c.reset} ${block.text.substring(0, 80)}`);
            this.socket.emit("daemon:response", {
              content: block.text,
              type: "text",
              done: false,
            });
          } else if (block.type === "tool_use") {
            const description = describeToolUse(block.name, block.input || {});
            console.log(`  ${c.blue}[tool]${c.reset} ${description}`);
            this.socket.emit("daemon:activity", {
              type: "tool_use",
              tool: block.name,
              message: description,
              input: block.input || {},
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
        console.log(`  ${c.dim}[system] ${event.subtype || "unknown"}${c.reset}`);
        break;
      }

      case "result": {
        const resultText = event.result;
        const isError = event.is_error;
        const costUsd = event.total_cost_usd;
        const durationMs = event.duration_ms;
        const sessionId = event.session_id;

        if (sessionId) {
          this.conversationId = sessionId;
        }

        const costStr = costUsd != null ? `$${costUsd.toFixed(4)}` : "?";
        const durationStr = durationMs != null ? `${durationMs}ms` : "?";
        console.log(`  ${c.magenta}[result]${c.reset} ${isError ? "ERROR" : "OK"} cost=${costStr} duration=${durationStr}`);

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
    }
  }

  sendPermissionResponse(approved) {
    console.log(`  ${c.dim}[perm] ${approved ? "APPROVED" : "DENIED"}${c.reset}`);
  }

  kill() {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const { pairingCode, workingDir, dangerousMode, relay } = parseArgs();

  // Check Claude Code is available
  const cliPath = getClaudeCLI();
  if (!cliPath) {
    console.error(`
${c.red}${c.bold}Claude Code not found!${c.reset}

Install it first:
  ${c.cyan}npm install -g @anthropic-ai/claude-code${c.reset}

Then authenticate (one time):
  ${c.cyan}claude${c.reset}
`);
    process.exit(1);
  }

  // Banner
  console.log(`
  ${c.bold}${c.cyan}ZecruAI${c.reset} ${c.dim}v0.1.0${c.reset}
  ${c.dim}────────────────────────────${c.reset}
  ${c.bold}Code:${c.reset}      ${c.cyan}${pairingCode}${c.reset}
  ${c.bold}Directory:${c.reset} ${workingDir}
  ${c.bold}Relay:${c.reset}     ${relay}${dangerousMode ? `\n  ${c.bold}Mode:${c.reset}      ${c.yellow}AUTO-APPROVE${c.reset}` : ""}
  ${c.dim}────────────────────────────${c.reset}
`);

  console.log(`  ${c.dim}Connecting to relay...${c.reset}`);

  // Load socket.io-client
  let io;
  try {
    io = require("socket.io-client").io;
  } catch {
    console.error(`
${c.red}socket.io-client not found!${c.reset}

If you installed ZecruAI globally, try reinstalling:
  ${c.cyan}npm install -g zecru-ai${c.reset}

Or install the dependency manually:
  ${c.cyan}npm install -g socket.io-client${c.reset}
`);
    process.exit(1);
  }

  const socket = io(relay, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  const bridge = new ClaudeCodeBridge(socket, workingDir, dangerousMode);

  socket.on("connect", () => {
    console.log(`  ${c.green}Connected to relay!${c.reset}`);
    socket.emit("daemon:register", {
      pairingCode,
      workingDir,
    });
  });

  socket.on("daemon:registered", (data) => {
    if (data.success) {
      console.log(`  ${c.green}${c.bold}Ready!${c.reset} Waiting for messages from ZecruAI...`);
      console.log(`  ${c.dim}────────────────────────────${c.reset}`);
    }
  });

  socket.on("daemon:message", (data) => {
    console.log(`\n  ${c.bold}${c.cyan}━━━ New message ━━━${c.reset}`);
    bridge.sendMessage(data.content, data.conversationId);
  });

  socket.on("daemon:permission_response", (data) => {
    bridge.sendPermissionResponse(data.approved);
  });

  socket.on("disconnect", (reason) => {
    console.log(`\n  ${c.yellow}Disconnected: ${reason}. Reconnecting...${c.reset}`);
  });

  socket.on("connect_error", (err) => {
    console.error(`  ${c.red}Connection error: ${err.message}${c.reset}`);
    if (err.message.includes("ECONNREFUSED")) {
      console.error(`  ${c.dim}Is the relay server running at ${relay}?${c.reset}`);
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log(`\n  ${c.dim}Shutting down...${c.reset}`);
    bridge.kill();
    socket.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(`\n${c.red}Fatal error: ${err.message}${c.reset}\n`);
  process.exit(1);
});
