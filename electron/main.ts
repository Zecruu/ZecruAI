import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import * as crypto from "crypto";

// ── Resource resolution ─────────────────────────────────────────────
const IS_DEV = !app.isPackaged;

function getResourcePath(...segments: string[]): string {
  if (IS_DEV) {
    return path.join(__dirname, "..", ...segments);
  }
  return path.join(process.resourcesPath, "app", ...segments);
}

// ── Persistent data dir ─────────────────────────────────────────────
const USER_DATA = app.getPath("userData");
const ENV_FILE = path.join(USER_DATA, "zecru.env");

function loadEnvFile(): Record<string, string> {
  const env: Record<string, string> = {};

  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
  }

  if (!env.JWT_SECRET) {
    env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  }

  return env;
}

function saveEnvFile(env: Record<string, string>): void {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf-8");
}

function needsSetup(env: Record<string, string>): boolean {
  return !env.MONGODB_URI || env.MONGODB_URI === "mongodb://127.0.0.1:27017/zecruai";
}

// ── Setup window ────────────────────────────────────────────────────
function showSetupWindow(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const setupWin = new BrowserWindow({
      width: 560,
      height: 520,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: "ZecruAI — Setup",
      icon: getResourcePath("public", "android-chrome-512x512.png"),
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
      backgroundColor: "#0a0a0a",
      show: false,
    });

    setupWin.setMenuBarVisibility(false);

    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0a0a0a; color: #e5e5e5;
    display: flex; flex-direction: column; align-items: center;
    padding: 40px 32px 32px;
  }
  .logo {
    width: 56px; height: 56px; border-radius: 14px;
    background: #7c5aed; display: flex; align-items: center; justify-content: center;
    font-weight: bold; font-size: 24px; color: white; margin-bottom: 16px;
  }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #888; margin-bottom: 28px; }
  label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; text-align: left; width: 100%; }
  input {
    width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #333;
    background: #1a1a1a; color: #e5e5e5; font-size: 13px; font-family: monospace;
    outline: none; margin-bottom: 8px;
  }
  input:focus { border-color: #7c5aed; }
  .hint { font-size: 11px; color: #666; margin-bottom: 24px; text-align: left; width: 100%; line-height: 1.5; }
  .hint a { color: #7c5aed; text-decoration: none; }
  .hint a:hover { text-decoration: underline; }
  button {
    width: 100%; padding: 12px; border: none; border-radius: 10px;
    background: #7c5aed; color: white; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s;
  }
  button:hover { opacity: 0.9; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .status { font-size: 12px; margin-top: 12px; min-height: 18px; }
  .error { color: #ef4444; }
  .success { color: #22c55e; }
  .skip { margin-top: 16px; font-size: 12px; color: #666; cursor: pointer; background: none; border: none; width: auto; }
  .skip:hover { color: #999; }
</style>
</head>
<body>
  <div class="logo">Z</div>
  <h1>Welcome to ZecruAI</h1>
  <p class="sub">Connect your MongoDB database to get started.</p>

  <label for="uri">MongoDB Connection String</label>
  <input id="uri" type="text" placeholder="mongodb+srv://user:pass@cluster.mongodb.net/?appName=ZecruAI" spellcheck="false" />
  <div class="hint">
    Get a free database from <a href="#" onclick="require('electron').shell.openExternal('https://www.mongodb.com/atlas');return false;">MongoDB Atlas</a>.
    Create a cluster, then copy the connection string.
  </div>

  <button id="connect" onclick="testAndSave()">Connect</button>
  <div class="status" id="status"></div>
  <button class="skip" onclick="skipSetup()">Skip — use local MongoDB (127.0.0.1:27017)</button>

<script>
  const { ipcRenderer } = require('electron');

  async function testAndSave() {
    const uri = document.getElementById('uri').value.trim();
    const btn = document.getElementById('connect');
    const status = document.getElementById('status');

    if (!uri) { status.className = 'status error'; status.textContent = 'Please enter a connection string.'; return; }

    btn.disabled = true;
    status.className = 'status'; status.textContent = 'Testing connection...';

    try {
      const result = await ipcRenderer.invoke('setup:test-mongo', uri);
      if (result.ok) {
        status.className = 'status success'; status.textContent = 'Connected! Starting ZecruAI...';
        await ipcRenderer.invoke('setup:save', uri);
      } else {
        status.className = 'status error'; status.textContent = result.error || 'Connection failed.';
        btn.disabled = false;
      }
    } catch (e) {
      status.className = 'status error'; status.textContent = e.message || 'Connection failed.';
      btn.disabled = false;
    }
  }

  async function skipSetup() {
    document.getElementById('status').className = 'status';
    document.getElementById('status').textContent = 'Starting with local MongoDB...';
    await ipcRenderer.invoke('setup:save', 'mongodb://127.0.0.1:27017/zecruai');
  }

  document.getElementById('uri').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') testAndSave();
  });
</script>
</body>
</html>`;

    const tmpHtml = path.join(USER_DATA, "setup.html");
    fs.writeFileSync(tmpHtml, html, "utf-8");
    setupWin.loadFile(tmpHtml);

    setupWin.once("ready-to-show", () => setupWin.show());

    let resolved = false;

    ipcMain.handle("setup:test-mongo", async (_event, uri: string) => {
      try {
        const { MongoClient } = require("mongodb");
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        await client.db().command({ ping: 1 });
        await client.close();
        return { ok: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    });

    ipcMain.handle("setup:save", async (_event, uri: string) => {
      const env = loadEnvFile();
      env.MONGODB_URI = uri;
      saveEnvFile(env);

      ipcMain.removeHandler("setup:test-mongo");
      ipcMain.removeHandler("setup:save");

      if (!resolved) {
        resolved = true;
        setupWin.close();
        try { fs.unlinkSync(tmpHtml); } catch {}
        resolve(env);
      }
    });

    setupWin.on("closed", () => {
      ipcMain.removeHandler("setup:test-mongo");
      ipcMain.removeHandler("setup:save");
      if (!resolved) {
        resolved = true;
        resolve(loadEnvFile());
      }
    });
  });
}

// ── Server process management ───────────────────────────────────────
let serverProcess: ChildProcess | null = null;
const SERVER_PORT = 3000;

function startServer(envVars: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverJs = getResourcePath("dist-server", "server.js");

    const serverEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
      NODE_ENV: "production",
      PORT: String(SERVER_PORT),
      NEXT_DIR: getResourcePath(".next"),
      ELECTRON_APP_ROOT: getResourcePath(),
    };

    serverProcess = spawn(process.execPath, [serverJs], {
      cwd: getResourcePath(),
      env: serverEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProcess.stdout?.on("data", (data: Buffer) => {
      console.log("[server]", data.toString().trim());
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[server:err]", data.toString().trim());
    });

    serverProcess.on("error", (err) => {
      reject(new Error(`Server failed to start: ${err.message}`));
    });

    serverProcess.on("exit", (code) => {
      console.log(`[server] exited with code ${code}`);
      serverProcess = null;
    });

    waitForServer(SERVER_PORT, 30000).then(resolve).catch(reject);
  });
}

function waitForServer(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function poll() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server did not start within ${timeoutMs}ms`));
        return;
      }
      const req = http.get(`http://127.0.0.1:${port}/api/auth/me`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        setTimeout(poll, 500);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(poll, 500);
      });
    }
    poll();
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

// ── BrowserWindow ───────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "ZecruAI",
    icon: getResourcePath("public", "android-chrome-512x512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#0a0a0a",
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Auto-updater ────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    console.log(`[updater] Update available: ${info.version}`);
    mainWindow?.webContents.send("update-available", { version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[updater] Up to date.");
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow?.webContents.send("update-progress", {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log(`[updater] Update ${info.version} downloaded.`);
    mainWindow?.webContents.send("update-downloaded", { version: info.version });
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err.message);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 5000);
}

// ── IPC handlers ────────────────────────────────────────────────────
ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("app:install-update", () => {
  autoUpdater.quitAndInstall(false, true);
});
ipcMain.handle("app:get-env-file-path", () => ENV_FILE);

// ── App lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  let envVars = loadEnvFile();
  saveEnvFile(envVars);

  if (needsSetup(envVars)) {
    envVars = await showSetupWindow();
  }

  try {
    await startServer(envVars);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: "ZecruAI — Startup Failed",
      message: `The server failed to start:\n\n${message}`,
      detail: `Check your MongoDB connection string in:\n${ENV_FILE}`,
      buttons: ["Reconfigure", "Quit"],
      defaultId: 0,
    });

    if (response === 0) {
      envVars = await showSetupWindow();
      try {
        await startServer(envVars);
      } catch {
        dialog.showErrorBox(
          "ZecruAI — Startup Failed",
          `Still unable to connect. Check your MongoDB URI and try again.\n\nConfig file: ${ENV_FILE}`
        );
        app.quit();
        return;
      }
    } else {
      app.quit();
      return;
    }
  }

  createWindow();

  if (!IS_DEV) {
    setupAutoUpdater();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
});
