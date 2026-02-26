import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download ZecruAI for Windows",
  description: "Download the ZecruAI desktop app for Windows. Your AI agent runs locally.",
};

export const revalidate = 3600;

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/Zecruu/ZecruAI/releases/latest",
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export default async function DownloadPage() {
  const release = await getLatestRelease();
  const exeAsset = release?.assets.find((a) => a.name.endsWith(".exe"));
  const version = release?.tag_name ?? "v0.1.4";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-xl w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-2xl">Z</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            ZecruAI for Windows
          </h1>
          <p className="text-muted text-sm">
            Your AI agent — runs entirely on your computer.
          </p>
        </div>

        {/* Version badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 bg-surface px-4 py-2 rounded-full text-sm text-muted">
            <span className="w-2 h-2 rounded-full bg-accent inline-block" />
            Latest: {version}
          </span>
        </div>

        {/* Download button */}
        {exeAsset ? (
          <div className="space-y-3">
            <a
              href={exeAsset.browser_download_url}
              className="inline-flex items-center gap-3 bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg w-full justify-center"
            >
              Download for Windows
              <span className="text-white/70 text-sm font-normal">
                {formatBytes(exeAsset.size)}
              </span>
            </a>
            <p className="text-xs text-muted">
              Windows 10/11 64-bit. No account required for local use.
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-xl px-6 py-4 text-muted text-sm">
            No installer available yet. Check back soon or build from source on{" "}
            <a
              href="https://github.com/Zecruu/ZecruAI"
              className="text-accent hover:underline"
            >
              GitHub
            </a>.
          </div>
        )}

        {/* Install instructions */}
        <div className="bg-surface rounded-2xl p-6 text-left space-y-4">
          <h2 className="font-semibold text-foreground">Installation</h2>
          <ol className="space-y-3 text-sm text-muted list-none">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold flex-shrink-0">
                1
              </span>
              <span>
                Run <strong className="text-foreground">ZecruAI-Setup-{version.replace("v", "")}.exe</strong> and
                follow the installer prompts.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold flex-shrink-0">
                2
              </span>
              <span>ZecruAI opens in its own window. No browser needed.</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold flex-shrink-0">
                3
              </span>
              <span>
                On first launch, configure your MongoDB connection. A local MongoDB or{" "}
                <a href="https://www.mongodb.com/atlas" className="text-accent hover:underline">
                  Atlas free tier
                </a>{" "}
                both work.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold flex-shrink-0">
                4
              </span>
              <span>
                Run{" "}
                <code className="bg-background px-1.5 py-0.5 rounded text-xs text-accent">
                  claude
                </code>{" "}
                once in any terminal to authenticate with Anthropic.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold flex-shrink-0">
                5
              </span>
              <span>Updates download automatically and install on next restart.</span>
            </li>
          </ol>
        </div>

        {/* System requirements */}
        <div className="text-xs text-muted space-y-1">
          <p>Requires Windows 10 or 11 (64-bit). Node.js is bundled — no separate install needed.</p>
          <p>MongoDB required for conversation history.</p>
        </div>

        {/* Footer links */}
        <div className="text-xs text-muted border-t border-border pt-4 space-x-2">
          <a href="/" className="hover:text-foreground transition-colors">
            Back to ZecruAI
          </a>
          <span>·</span>
          <a
            href="https://github.com/Zecruu/ZecruAI/releases"
            className="hover:text-foreground transition-colors"
          >
            All releases
          </a>
          <span>·</span>
          <a
            href="https://github.com/Zecruu/ZecruAI"
            className="hover:text-foreground transition-colors"
          >
            Source code
          </a>
        </div>
      </div>
    </div>
  );
}
