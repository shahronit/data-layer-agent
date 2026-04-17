"use client";

import { useEffect, useState } from "react";

interface ScanSession {
  id: string;
  url: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  score: number | null;
}

interface Props {
  onSelectScan: (scanId: string) => void;
}

export function ScanHistory({ onSelectScan }: Props) {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scan")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.sessions)) setSessions(d.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-xs text-white/35">Loading scan history...</p>;
  if (sessions.length === 0) return <p className="text-xs text-white/35">No previous scans found.</p>;

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Recent Scans</h4>
      <div className="max-h-60 space-y-1 overflow-y-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectScan(s.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${
              s.status === "complete" ? "bg-emerald-400" : s.status === "running" ? "animate-pulse bg-violet-400" : "bg-rose-400"
            }`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white/65">{s.url}</p>
              <p className="text-[10px] text-white/30">
                {new Date(s.started_at).toLocaleString()}
                {s.score !== null && <span className="ml-2 text-white/50">Score: {s.score}</span>}
              </p>
            </div>
            <span className={`text-[10px] font-medium ${
              s.status === "complete" ? "text-emerald-300/60" : s.status === "running" ? "text-violet-300/60" : "text-rose-300/60"
            }`}>
              {s.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
