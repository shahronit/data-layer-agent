"use client";

import { useState } from "react";

interface ScreenshotEntry {
  filepath: string;
  interactionIndex?: number;
  label?: string;
}

interface Props {
  screenshots: ScreenshotEntry[];
  scanId: string;
}

function screenshotUrl(storedPath: string, fallbackScanId: string): string {
  const parts = storedPath.split("/");
  if (parts.length >= 2) {
    const file = parts.pop() as string;
    const dir = parts.join("/");
    return `/api/scan/${dir}/screenshots/${file}`;
  }
  return `/api/scan/${fallbackScanId}/screenshots/${storedPath}`;
}

export function ScreenshotGallery({ screenshots, scanId }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (screenshots.length === 0) {
    return <p className="text-sm text-white/45">No screenshots captured. Enable screenshots in scan settings.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">{screenshots.length} screenshots captured</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {screenshots.map((ss, i) => {
          const filename = ss.filepath.split("/").pop() || "";
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
              className={`group overflow-hidden rounded-xl border transition ${
                selectedIdx === i
                  ? "border-violet-400/50 ring-2 ring-violet-500/25"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <img
                src={screenshotUrl(ss.filepath, scanId)}
                alt={ss.label || `Screenshot ${i + 1}`}
                className="aspect-video w-full object-cover transition group-hover:brightness-110"
                loading="lazy"
              />
              <div className="bg-black/40 px-2 py-1.5 text-[10px] text-white/50">
                {ss.label || filename}
              </div>
            </button>
          );
        })}
      </div>

      {selectedIdx !== null && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/60">
              {screenshots[selectedIdx].label || screenshots[selectedIdx].filepath.split("/").pop()}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIdx(null)}
              className="text-xs text-white/40 hover:text-white/70"
            >
              Close
            </button>
          </div>
          <img
            src={screenshotUrl(screenshots[selectedIdx].filepath, scanId)}
            alt="Full size screenshot"
            className="w-full rounded-lg border border-white/5"
          />
        </div>
      )}
    </div>
  );
}
