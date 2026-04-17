"use client";

import { useState } from "react";

interface Interaction {
  id: string;
  element_tag: string;
  element_text: string;
  element_category: string;
  interaction_type: string;
  order_index: number;
  duration_ms: number;
  error: string | null;
  screenshot_path: string | null;
  diff_json: string | null;
  events?: Array<{ event_name: string; source: string; payload_json: string }>;
  validations?: Array<{ schema_name: string; status: string; errors_json: string | null }>;
}

interface Props {
  interactions: Interaction[];
  scanId: string;
}

function StatusBadge({ hasError, eventCount }: { hasError: boolean; eventCount: number }) {
  if (hasError) return <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/30">FAILED</span>;
  if (eventCount > 0) return <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">{eventCount} events</span>;
  return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">No events</span>;
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    addToCart: "bg-violet-500/20 text-violet-200 ring-violet-400/30",
    productCard: "bg-blue-500/15 text-blue-200 ring-blue-400/30",
    filter: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
    pagination: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25",
    checkout: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
    navigation: "bg-slate-500/15 text-slate-200 ring-slate-400/25",
    generic: "bg-white/10 text-white/50 ring-white/15",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${colors[category] || colors.generic}`}>
      {category}
    </span>
  );
}

export function InteractionTimeline({ interactions, scanId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (interactions.length === 0) {
    return <p className="text-sm text-white/45">No interactions recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">{interactions.length} Interactions</h3>
      </div>

      <div className="relative space-y-0">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/40 via-cyan-500/20 to-transparent" />

        {interactions.map((ix) => {
          const events = ix.events || [];
          const expanded = expandedId === ix.id;
          const diff = ix.diff_json ? JSON.parse(ix.diff_json) : null;

          return (
            <div key={ix.id} className="relative pl-10">
              <div className={`absolute left-[11px] top-4 h-2.5 w-2.5 rounded-full border-2 ${ix.error ? "border-rose-400 bg-rose-400/30" : events.length > 0 ? "border-emerald-400 bg-emerald-400/30" : "border-amber-400 bg-amber-400/30"}`} />

              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : ix.id)}
                className="w-full rounded-xl border border-white/8 bg-white/[0.02] p-3 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/35">#{ix.order_index + 1}</span>
                      <span className="text-sm font-medium text-white/80">
                        {ix.interaction_type} &lt;{ix.element_tag}&gt;
                      </span>
                      <CategoryBadge category={ix.element_category} />
                    </div>
                    <p className="mt-1 truncate text-xs text-white/45">{ix.element_text || "(no text)"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge hasError={Boolean(ix.error)} eventCount={events.length} />
                    <span className="text-[10px] text-white/30">{ix.duration_ms}ms</span>
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="mt-1 rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  {ix.error && (
                    <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      {ix.error}
                    </div>
                  )}

                  {events.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Events Captured</h4>
                      <div className="space-y-1">
                        {events.map((ev, i) => (
                          <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-200 ring-1 ring-blue-400/30">
                                {ev.source}
                              </span>
                              <span className="font-medium text-white/70">{ev.event_name}</span>
                            </div>
                            {ev.payload_json && (
                              <pre className="mt-1 max-h-20 overflow-y-auto text-[10px] text-white/40 font-mono">
                                {JSON.stringify(JSON.parse(ev.payload_json), null, 2).slice(0, 300)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {diff?.dataLayerChanges?.added?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">DataLayer Changes</h4>
                      <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/70">
                        +{diff.dataLayerChanges.added.length} new entries
                      </div>
                    </div>
                  )}

                  {ix.screenshot_path && (
                    <div>
                      <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Screenshot</h4>
                      <img
                        src={`/api/scan/${scanId}/screenshots/${ix.screenshot_path.split("/").pop()}`}
                        alt={`Interaction ${ix.order_index + 1}`}
                        className="rounded-lg border border-white/10 max-h-48 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
