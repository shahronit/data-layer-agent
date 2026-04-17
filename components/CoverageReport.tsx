"use client";

interface CoverageData {
  totalElements: number;
  testedElements: number;
  coveragePct: number;
  untestedElements: Array<{ selector: string; tag: string; text: string; category: string }>;
  byCategory?: Record<string, { total: number; tested: number; pct: number }>;
}

interface Props {
  data: CoverageData | null;
}

function CoverageRing({ pct }: { pct: number }) {
  const deg = Math.min(pct, 100) * 3.6;
  const color = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div
      className="relative h-24 w-24 shrink-0 rounded-full p-[3px]"
      style={{ background: `conic-gradient(from 210deg, ${color} ${deg}deg, rgba(255,255,255,0.08) ${deg}deg)` }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#0c0c12]">
        <span className="text-xl font-bold text-white">{Math.round(pct)}%</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/35">Coverage</span>
      </div>
    </div>
  );
}

export function CoverageReport({ data }: Props) {
  if (!data) {
    return <p className="text-sm text-white/45">No coverage data available. Run a scan first.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6">
        <CoverageRing pct={data.coveragePct} />
        <div>
          <p className="text-sm text-white/70">
            <span className="text-lg font-bold text-white">{data.testedElements}</span> of{" "}
            <span className="text-lg font-bold text-white">{data.totalElements}</span> elements tested
          </p>
          <p className="mt-1 text-xs text-white/40">
            {data.totalElements - data.testedElements} elements remain untested
          </p>
        </div>
      </div>

      {data.byCategory && Object.keys(data.byCategory).length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Coverage by Category</h4>
          <div className="space-y-2">
            {Object.entries(data.byCategory)
              .sort(([, a], [, b]) => a.pct - b.pct)
              .map(([cat, info]) => (
                <div key={cat} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white/65 capitalize">{cat}</span>
                    <span className="text-white/40">
                      {info.tested}/{info.total} ({Math.round(info.pct)}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${info.pct >= 80 ? "bg-emerald-400" : info.pct >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
                      style={{ width: `${Math.min(info.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {data.untestedElements.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-white/50 hover:text-white/70">
            Untested Elements ({data.untestedElements.length})
          </summary>
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {data.untestedElements.map((el, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-[10px]">
                <span className="font-mono text-amber-300/60">&lt;{el.tag}&gt;</span>
                <span className="ml-2 text-white/40">{el.text || "(no text)"}</span>
                <span className="ml-2 rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-white/30">{el.category}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
