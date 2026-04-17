"use client";

import type { ScanProgressEvent } from "@/lib/scan-config";

interface Props {
  events: ScanProgressEvent[];
  isRunning: boolean;
}

export function ScanProgress({ events, isRunning }: Props) {
  const lastPhase = [...events].reverse().find((e) => e.type === "phase");
  const detectionEvent = events.find((e) => e.type === "detection");
  const coverageEvent = events.find((e) => e.type === "coverage");
  const completeEvent = events.find((e) => e.type === "complete");
  const errorEvent = [...events].reverse().find((e) => e.type === "error");

  const interactionEvents = events.filter((e) => e.type === "interaction");
  const totalPlanned = (detectionEvent?.data?.planned as number) || 0;
  const progress = totalPlanned > 0 ? Math.round((interactionEvents.length / totalPlanned) * 100) : 0;

  return (
    <div className="space-y-3">
      {isRunning && (
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.6)]" />
          <span className="text-sm font-medium text-white/80">{lastPhase?.message || "Starting scan..."}</span>
        </div>
      )}

      {totalPlanned > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Interactions: {interactionEvents.length}/{totalPlanned}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {coverageEvent && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
          {coverageEvent.message}
        </div>
      )}

      {errorEvent && (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {errorEvent.message}
        </div>
      )}

      {completeEvent && !isRunning && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {completeEvent.message}
        </div>
      )}

      {interactionEvents.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-white/40 hover:text-white/60">
            Activity log ({events.length} events)
          </summary>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[10px] text-white/50">
            {events.slice(-20).map((e, i) => (
              <div key={i} className="py-0.5">
                <span className={`inline-block w-16 ${e.type === "error" ? "text-rose-300" : e.type === "complete" ? "text-emerald-300" : "text-white/30"}`}>
                  [{e.type}]
                </span>
                {e.message}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
