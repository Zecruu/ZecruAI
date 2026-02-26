"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

export default function ElectronUpdateBanner() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable((data) => {
      setUpdateVersion(data.version);
    });

    window.electronAPI.onUpdateProgress((data) => {
      setProgress(data.percent);
    });

    window.electronAPI.onUpdateDownloaded((data) => {
      setUpdateVersion(data.version);
      setDownloaded(true);
      setProgress(null);
    });
  }, []);

  if (!updateVersion) return null;

  return (
    <div className="bg-accent/10 border-b border-accent/30 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {downloaded ? (
          <RefreshCw size={14} className="text-accent" />
        ) : (
          <Download size={14} className="text-accent" />
        )}
        <span className="text-accent font-medium">
          {downloaded
            ? `ZecruAI ${updateVersion} ready — will install on restart.`
            : progress !== null
            ? `Downloading update ${updateVersion}... ${progress}%`
            : `Update ${updateVersion} is downloading...`}
        </span>
      </div>
      {downloaded && (
        <button
          onClick={() => window.electronAPI?.installUpdate()}
          className="text-xs bg-accent text-white px-3 py-1 rounded-lg hover:bg-accent/90 transition-colors"
        >
          Restart Now
        </button>
      )}
    </div>
  );
}
