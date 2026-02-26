import path from "path";

/**
 * Returns the root directory where daemon scripts and node_modules live.
 * In Electron production: ELECTRON_APP_ROOT (set by electron/main.ts)
 * In web/Railway: process.cwd()
 */
export function getAppRoot(): string {
  return process.env.ELECTRON_APP_ROOT || process.cwd();
}
