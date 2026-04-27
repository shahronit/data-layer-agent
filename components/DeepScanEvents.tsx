"use client";

import { useMemo, useState } from "react";

interface Step {
  index: number;
  scanId?: string;
  element: { selector: string; tag: string; text: string; category: string };
  interactionType: string;
  events: Array<{ source: string; event_name: string; payload: unknown }>;
}

interface PageLoad {
  events: Array<{ source: string; event_name: string; payload: unknown }>;
}

interface Props {
  steps: Step[];
  pageLoad: PageLoad;
}

interface Row {
  group: string;
  source: string;
  eventName: string;
  payload: unknown;
}

export function DeepScanEvents({ steps, pageLoad }: Props) {
  const [filter, setFilter] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const ev of pageLoad.events ?? []) {
      out.push({ group: "Page load", source: ev.source, eventName: ev.event_name, payload: ev.payload });
    }
    for (const step of steps) {
      const label = `#${step.index + 1} ${step.interactionType} on <${step.element.tag}>${step.element.text ? ` "${step.element.text.slice(0, 40)}"` : ""}`;
      for (const ev of step.events ?? []) {
        out.push({ group: label, source: ev.source, eventName: ev.event_name, payload: ev.payload });
      }
    }
    return out;
  }, [steps, pageLoad]);

  const sources = useMemo(() => Array.from(new Set(rows.map((r) => r.source))).sort(), [rows]);
  const filtered = filter ? rows.filter((r) => r.source === filter) : rows;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-white/45">
        No events captured during this scan. If you expect tags here, raise the post-load wait or verify the
        consent gate isn’t blocking them.
      </p>
    );
  }

  // Group rows by `group` for display.
  const grouped: Record<string, Row[]> = {};
  for (const r of filtered) {
    if (!grouped[r.group]) grouped[r.group] = [];
    grouped[r.group].push(r);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Source</span>
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
            filter === null
              ? "border-violet-400/50 bg-violet-500/20 text-white"
              : "border-white/10 text-white/50 hover:border-white/20"
          }`}
        >
          All ({rows.length})
        </button>
        {sources.map((s) => {
          const count = rows.filter((r) => r.source === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
                filter === s
                  ? "border-violet-400/50 bg-violet-500/20 text-white"
                  : "border-white/10 text-white/50 hover:border-white/20"
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([group, groupRows]) => (
          <div key={group} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="border-b border-white/8 bg-white/[0.03] px-4 py-2">
              <h4 className="text-xs font-semibold text-white/65">{group}</h4>
              <span className="text-[10px] text-white/35">{groupRows.length} events</span>
            </div>
            <div className="divide-y divide-white/5">
              {groupRows.map((r, i) => (
                <details key={`${r.eventName}-${i}`} className="px-4 py-2">
                  <summary className="cursor-pointer text-xs">
                    <span className="font-medium text-cyan-200/80">{r.source}</span>
                    <span className="mx-1.5 text-white/20">/</span>
                    <span className="text-white/70">{r.eventName}</span>
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/5 bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-white/55">
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
