"use client";

import { useState } from "react";

interface DiffEntry {
  index: number;
  event?: string;
  payload: unknown;
}

interface EventDiffData {
  dataLayerChanges: {
    added: DiffEntry[];
    removed: DiffEntry[];
    modified: Array<{ before: DiffEntry; after: DiffEntry }>;
  };
  digitalDataChanges: Array<{ path: string; before: unknown; after: unknown }>;
  newEvents: Array<{ eventName: string; source: string; payload: unknown }>;
}

interface Props {
  diff: EventDiffData;
  interactionLabel: string;
}

export function EventDiffViewer({ diff, interactionLabel }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const hasChanges =
    diff.dataLayerChanges.added.length > 0 ||
    diff.dataLayerChanges.removed.length > 0 ||
    diff.dataLayerChanges.modified.length > 0 ||
    diff.digitalDataChanges.length > 0;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">{interactionLabel}</h4>
        <button
          type="button"
          onClick={() => setShowRaw((r) => !r)}
          className="text-[10px] text-cyan-400 hover:underline"
        >
          {showRaw ? "Formatted" : "Raw JSON"}
        </button>
      </div>

      {!hasChanges && diff.newEvents.length === 0 && (
        <p className="text-xs text-white/35">No dataLayer or digitalData changes detected.</p>
      )}

      {diff.dataLayerChanges.added.length > 0 && (
        <div>
          <h5 className="mb-1 text-[10px] font-bold uppercase text-emerald-300/70">+ Added ({diff.dataLayerChanges.added.length})</h5>
          <div className="space-y-1">
            {diff.dataLayerChanges.added.map((entry, i) => (
              <div key={i} className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                {entry.event && <span className="text-xs font-medium text-emerald-200">{entry.event}</span>}
                <pre className="mt-1 max-h-24 overflow-y-auto font-mono text-[10px] text-emerald-100/50">
                  {showRaw
                    ? JSON.stringify(entry.payload, null, 2)
                    : JSON.stringify(entry.payload, null, 2).slice(0, 200)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.dataLayerChanges.removed.length > 0 && (
        <div>
          <h5 className="mb-1 text-[10px] font-bold uppercase text-rose-300/70">- Removed ({diff.dataLayerChanges.removed.length})</h5>
          <div className="space-y-1">
            {diff.dataLayerChanges.removed.map((entry, i) => (
              <div key={i} className="rounded-lg border border-rose-500/15 bg-rose-500/5 px-3 py-2">
                <pre className="max-h-16 overflow-y-auto font-mono text-[10px] text-rose-100/50">
                  {JSON.stringify(entry.payload, null, 2).slice(0, 200)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.dataLayerChanges.modified.length > 0 && (
        <div>
          <h5 className="mb-1 text-[10px] font-bold uppercase text-amber-300/70">~ Modified ({diff.dataLayerChanges.modified.length})</h5>
          <div className="space-y-1">
            {diff.dataLayerChanges.modified.map((mod, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-rose-500/10 bg-rose-500/5 px-2 py-1">
                  <span className="text-[9px] font-bold text-rose-300/60">BEFORE</span>
                  <pre className="max-h-16 overflow-y-auto font-mono text-[9px] text-white/40">
                    {JSON.stringify(mod.before.payload, null, 2).slice(0, 150)}
                  </pre>
                </div>
                <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-2 py-1">
                  <span className="text-[9px] font-bold text-emerald-300/60">AFTER</span>
                  <pre className="max-h-16 overflow-y-auto font-mono text-[9px] text-white/40">
                    {JSON.stringify(mod.after.payload, null, 2).slice(0, 150)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.digitalDataChanges.length > 0 && (
        <div>
          <h5 className="mb-1 text-[10px] font-bold uppercase text-violet-300/70">digitalData Changes ({diff.digitalDataChanges.length})</h5>
          <div className="space-y-1">
            {diff.digitalDataChanges.map((change, i) => (
              <div key={i} className="rounded-lg border border-violet-500/10 bg-violet-500/5 px-3 py-2 text-[10px]">
                <span className="font-mono font-medium text-violet-200">{change.path}</span>
                <div className="mt-1 grid grid-cols-2 gap-2 text-white/40">
                  <span>{JSON.stringify(change.before)?.slice(0, 60) ?? "undefined"}</span>
                  <span className="text-violet-200/60">{JSON.stringify(change.after)?.slice(0, 60) ?? "undefined"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
