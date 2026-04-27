"use client";

import { useMemo } from "react";

interface ValidationEntry {
  id: string;
  schema_name: string;
  status: "pass" | "fail" | "warn" | string;
  errors: Array<{ field: string; message: string; severity: string }>;
  element_text?: string | null;
  element_category?: string | null;
  order_index?: number | null;
}

interface InteractionEntry {
  id: string;
  element_tag: string;
  element_text: string;
  element_category: string;
  interaction_type: string;
  order_index: number;
  duration_ms: number;
  error: string | null;
}

interface CoverageData {
  totalElements: number;
  testedElements: number;
  coveragePct: number;
  untestedElements: Array<{ selector: string; tag: string; text: string; category: string }>;
}

interface ScanSession {
  id?: string;
  url?: string;
  score?: number | null;
  status?: string;
}

type Severity = "critical" | "high" | "medium" | "low";

interface Issue {
  severity: Severity;
  title: string;
  detail: string;
  remediation: string;
  source: "validation" | "interaction" | "coverage";
}

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const SEV_STYLE: Record<Severity, { dot: string; pill: string }> = {
  critical: { dot: "bg-rose-400", pill: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30" },
  high: { dot: "bg-orange-400", pill: "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30" },
  medium: { dot: "bg-amber-400", pill: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30" },
  low: { dot: "bg-cyan-400", pill: "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30" },
};

interface Props {
  session: ScanSession | null;
  interactions: InteractionEntry[];
  validation: { results: ValidationEntry[]; summary: { pass: number; fail: number; warn: number } } | null;
  coverage: CoverageData | null;
}

export function DeepScanIssues({ session, interactions, validation, coverage }: Props) {
  const issues = useMemo<Issue[]>(() => {
    const out: Issue[] = [];

    // Validation failures (one issue per failing entry).
    for (const r of validation?.results ?? []) {
      if (r.status === "fail") {
        const where = r.element_text
          ? `interaction #${(r.order_index ?? 0) + 1} — ${(r.element_text ?? "").slice(0, 60)}`
          : "page-load";
        const fields = r.errors.length > 0
          ? r.errors.map((e) => `${e.field}: ${e.message}`).join("; ")
          : `${r.schema_name} schema check failed`;
        out.push({
          severity: "high",
          source: "validation",
          title: `${r.schema_name} validation failed (${where})`,
          detail: fields,
          remediation:
            "Fix the offending tag payload so required fields are present and correctly typed for this schema. Re-run the deep scan to confirm.",
        });
      } else if (r.status === "warn") {
        const where = r.element_text
          ? `interaction #${(r.order_index ?? 0) + 1} — ${(r.element_text ?? "").slice(0, 60)}`
          : "page-load";
        const fields = r.errors.length > 0
          ? r.errors.map((e) => `${e.field}: ${e.message}`).join("; ")
          : `${r.schema_name} schema warning`;
        out.push({
          severity: "medium",
          source: "validation",
          title: `${r.schema_name} validation warning (${where})`,
          detail: fields,
          remediation:
            "Review whether this warning is acceptable for your spec. If not, update the tag payload and re-run.",
        });
      }
    }

    // Interaction errors (steps that threw during execution).
    for (const i of interactions) {
      if (i.error) {
        out.push({
          severity: "medium",
          source: "interaction",
          title: `Interaction #${i.order_index + 1} failed (${i.interaction_type} on <${i.element_tag}>)`,
          detail: `${i.element_text ? `"${i.element_text.slice(0, 60)}" — ` : ""}${i.error}`,
          remediation:
            "Element may have been hidden, navigated away, or covered by an overlay. Increase `settleTimeMs`, ensure the element is in viewport, or close any blocking modals before the interaction.",
        });
      }
    }

    // Coverage gaps: surface as a single low/medium issue if pct is poor.
    if (coverage && coverage.totalElements > 0) {
      if (coverage.coveragePct < 50) {
        out.push({
          severity: "medium",
          source: "coverage",
          title: `Low element coverage (${coverage.coveragePct}%)`,
          detail: `${coverage.testedElements} of ${coverage.totalElements} interactive elements were tested. ${coverage.untestedElements.length} remain untested.`,
          remediation:
            "Raise the `Max elements` limit, run a Full-scan journey step instead of Targeted, or add a journey step that visits the missing region.",
        });
      } else if (coverage.coveragePct < 80) {
        out.push({
          severity: "low",
          source: "coverage",
          title: `Partial element coverage (${coverage.coveragePct}%)`,
          detail: `${coverage.testedElements} of ${coverage.totalElements} interactive elements were tested.`,
          remediation:
            "Optional: bump `Max elements` or add a targeted journey step to cover the remaining elements.",
        });
      }
    }

    return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  }, [interactions, validation, coverage]);

  const score = session?.score ?? null;
  const totalInteractions = interactions.length;
  const failedInteractions = interactions.filter((i) => i.error).length;
  const valFail = validation?.summary.fail ?? 0;
  const valWarn = validation?.summary.warn ?? 0;
  const valPass = validation?.summary.pass ?? 0;

  if (!session && interactions.length === 0 && !validation && !coverage) {
    return <p className="text-sm text-white/45">Run a deep scan to populate the issues queue.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Score" value={score == null ? "—" : `${score}`} accent="violet" />
        <Tile
          label="Validation"
          value={`${valPass} pass / ${valFail} fail`}
          accent={valFail > 0 ? "rose" : "emerald"}
        />
        <Tile
          label="Interactions"
          value={`${totalInteractions - failedInteractions}/${totalInteractions} ok`}
          accent={failedInteractions > 0 ? "amber" : "emerald"}
        />
        <Tile
          label="Coverage"
          value={coverage ? `${coverage.coveragePct}%` : "—"}
          accent={!coverage ? "slate" : coverage.coveragePct >= 80 ? "emerald" : coverage.coveragePct >= 50 ? "amber" : "rose"}
        />
      </div>

      {valWarn > 0 && (
        <p className="text-[11px] text-white/40">
          {valWarn} validation warning{valWarn === 1 ? "" : "s"} also recorded — see the Validation tab.
        </p>
      )}

      {issues.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
          No issues detected for this scan. Validation passed, all interactions executed, and coverage is healthy.
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
            {issues.length} issue{issues.length === 1 ? "" : "s"} found
          </h4>
          <ul className="space-y-2">
            {issues.map((issue, idx) => (
              <li
                key={`${issue.source}-${idx}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${SEV_STYLE[issue.severity].dot}`} />
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEV_STYLE[issue.severity].pill}`}>
                    {issue.severity}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/55">
                    {issue.source}
                  </span>
                  <h5 className="ml-1 text-sm font-medium text-white">{issue.title}</h5>
                </div>
                <p className="mt-1.5 text-xs text-white/60">{issue.detail}</p>
                <p className="mt-1.5 text-[11px] text-white/40">
                  <span className="font-semibold text-white/55">Fix:</span> {issue.remediation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "violet" | "emerald" | "rose" | "amber" | "slate";
}) {
  const accentClass: Record<typeof accent, string> = {
    violet: "text-violet-200",
    emerald: "text-emerald-200",
    rose: "text-rose-200",
    amber: "text-amber-200",
    slate: "text-white/55",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1 text-sm font-bold ${accentClass[accent]}`}>{value}</p>
    </div>
  );
}
