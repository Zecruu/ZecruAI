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

function loadOrCreateEnv(): Record<string, string> {
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

  if (!env.MONGODB_URI) {
    env.MONGODB_URI = "mongodb://127.0.0.1:27017/zecruai";
  }

  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf-8");

  return env;
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
  const envVars = loadOrCreateEnv();

  try {
    await startServer(envVars);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      "ZecruAI — Startup Failed",
      `The server failed to start:\n\n${message}\n\nMake sure MongoDB is running or set MONGODB_URI in:\n${ENV_FILE}`
    );
    app.quit();
    return;
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
