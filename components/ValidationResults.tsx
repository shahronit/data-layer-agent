"use client";

import { useState } from "react";

interface ValidationEntry {
  id: string;
  schema_name: string;
  status: string;
  errors: Array<{ field: string; message: string; severity: string }>;
  element_text?: string;
  element_category?: string;
  order_index?: number;
}

interface Props {
  results: ValidationEntry[];
  summary: { pass: number; fail: number; warn: number };
}

function StatusIcon({ status }: { status: string }) {
  if (status === "pass") return <span className="text-emerald-400">&#x2713;</span>;
  if (status === "fail") return <span className="text-rose-400">&#x2717;</span>;
  return <span className="text-amber-400">&#x26A0;</span>;
}

export function ValidationResults({ results, summary }: Props) {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const filtered = filterStatus ? results.filter((r) => r.status === filterStatus) : results;

  const bySchema: Record<string, ValidationEntry[]> = {};
  for (const r of filtered) {
    if (!bySchema[r.schema_name]) bySchema[r.schema_name] = [];
    bySchema[r.schema_name].push(r);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-300">{summary.pass}</p>
            <p className="text-[9px] uppercase tracking-wider text-white/35">Pass</p>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-rose-300">{summary.fail}</p>
            <p className="text-[9px] uppercase tracking-wider text-white/35">Fail</p>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-amber-300">{summary.warn}</p>
            <p className="text-[9px] uppercase tracking-wider text-white/35">Warn</p>
          </div>
        </div>

        <div className="flex gap-1">
          {[null, "pass", "fail", "warn"].map((s) => (
            <button
              key={s ?? "all"}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
                filterStatus === s
                  ? "border-violet-400/50 bg-violet-500/20 text-white"
                  : "border-white/10 text-white/40 hover:border-white/20"
              }`}
            >
              {s === null ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(bySchema).map(([schema, entries]) => (
        <div key={schema} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="border-b border-white/8 bg-white/[0.03] px-4 py-2.5">
            <h4 className="text-xs font-bold text-white/65">{schema}</h4>
            <div className="mt-1 flex gap-3 text-[10px] text-white/35">
              <span className="text-emerald-300">{entries.filter((e) => e.status === "pass").length} pass</span>
              <span className="text-rose-300">{entries.filter((e) => e.status === "fail").length} fail</span>
              <span className="text-amber-300">{entries.filter((e) => e.status === "warn").length} warn</span>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {entries.map((entry) => (
              <div key={entry.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <StatusIcon status={entry.status} />
                  <span className="text-xs text-white/60">
                    {entry.element_text
                      ? `#${(entry.order_index ?? 0) + 1} — ${entry.element_text.slice(0, 40)}`
                      : "Page load"}
                  </span>
                </div>
                {entry.errors.length > 0 && (
                  <div className="ml-5 mt-1 space-y-0.5">
                    {entry.errors.map((err, i) => (
                      <p key={i} className="text-[10px] text-white/40">
                        <span className="font-mono text-amber-300/60">{err.field}</span>
                        <span className="mx-1">—</span>
                        {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-sm text-white/45">No validation results match the current filter.</p>
      )}
    </div>
  );
}
