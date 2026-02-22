import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface CollectedFile {
  relativePath: string;
  content: Buffer;
  sha1: string;
  size: number;
}

const DEFAULT_IGNORE = new Set([
  "node_modules", ".git", ".next", ".vercel", ".railway",
  "dist", "build", ".env", ".env.local", ".env.production",
  ".DS_Store", "Thumbs.db", ".turbo", ".cache",
]);

const MAX_FILES = 5000;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB

export async function collectFiles(rootDir: string): Promise<CollectedFile[]> {
  const files: CollectedFile[] = [];
  let totalSize = 0;

  // Load .gitignore patterns if present
  const extraIgnore = new Set<string>();
  try {
    const gitignore = await fs.readFile(path.join(rootDir, ".gitignore"), "utf-8");
    for (const line of gitignore.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        // Simple pattern: strip leading/trailing slashes for directory name matching
        extraIgnore.add(trimmed.replace(/^\/|\/$/g, ""));
      }
    }
  } catch {
    // No .gitignore — that's fine
  }

  async function walk(dir: string, rel: string) {
    if (files.length >= MAX_FILES) return;

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_FILES || totalSize >= MAX_TOTAL_SIZE) return;

      const name = entry.name;
      if (DEFAULT_IGNORE.has(name) || extraIgnore.has(name)) continue;
      if (name.startsWith(".env")) continue; // catch all .env variants

      const fullPath = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;

      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const content = await fs.readFile(fullPath);
        const sha1 = crypto.createHash("sha1").update(content).digest("hex");
        totalSize += content.length;
        files.push({ relativePath: relPath, content, sha1, size: content.length });
      }
    }
  }

  await walk(rootDir, "");
  return files;
}
