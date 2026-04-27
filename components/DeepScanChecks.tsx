"use client";

import { useMemo } from "react";

interface InteractionEntry {
  id: string;
  order_index: number;
  duration_ms: number;
  error: string | null;
}

interface ValidationEntry {
  id: string;
  schema_name: string;
  status: "pass" | "fail" | "warn" | string;
}

interface CoverageData {
  totalElements: number;
  testedElements: number;
  coveragePct: number;
}

interface JourneyStep {
  step_index: number;
  url: string;
  label: string | null;
  status: string;
}

interface ScanSession {
  url?: string;
  score?: number | null;
  status?: string;
  finished_at?: string | null;
}

type CheckStatus = "pass" | "fail" | "warn" | "info";

interface CheckRow {
  id: string;
  name: string;
  status: CheckStatus;
  detail: string;
}

interface Props {
  session: ScanSession | null;
  interactions: InteractionEntry[];
  validation: { results: ValidationEntry[]; summary: { pass: number; fail: number; warn: number } } | null;
  coverage: CoverageData | null;
  journeySteps: JourneyStep[] | null;
}

function StatusDot({ status }: { status: CheckStatus }) {
  const cls =
    status === "pass" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
    : status === "fail" ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.55)]"
    : status === "warn" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]"
    : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.45)]";
  return <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />;
}

export function DeepScanChecks({ session, interactions, validation, coverage, journeySteps }: Props) {
  const checks = useMemo<CheckRow[]>(() => {
    const out: CheckRow[] = [];

    // Page-load / scan completion.
    if (session?.status === "complete") {
      out.push({
        id: "scan-complete",
        name: "Scan ran to completion",
        status: "pass",
        detail: `Session for ${session.url ?? "(unknown url)"} finished${session.finished_at ? ` at ${new Date(session.finished_at).toLocaleString()}` : ""}.`,
      });
    } else if (session?.status === "failed") {
      out.push({
        id: "scan-complete",
        name: "Scan ran to completion",
        status: "fail",
        detail: "The scan session is marked failed. Re-run with longer waits or check the dev server logs.",
      });
    } else {
      out.push({
        id: "scan-complete",
        name: "Scan ran to completion",
        status: "info",
        detail: "Scan still in progress or status unknown.",
      });
    }

    // Per-schema validation rollup.
    const bySchema = new Map<string, { pass: number; fail: number; warn: number }>();
    for (const r of validation?.results ?? []) {
      const cur = bySchema.get(r.schema_name) ?? { pass: 0, fail: 0, warn: 0 };
      if (r.status === "pass" || r.status === "fail" || r.status === "warn") cur[r.status]++;
      bySchema.set(r.schema_name, cur);
    }
    if (bySchema.size === 0) {
      out.push({
        id: "validation-presence",
        name: "Schema validation",
        status: "warn",
        detail: "No validation results were produced. Enable GA4/Adobe/custom schemas and verify tags fire on at least one interaction.",
      });
    } else {
      for (const [schema, counts] of bySchema.entries()) {
        const status: CheckStatus = counts.fail > 0 ? "fail" : counts.warn > 0 ? "warn" : "pass";
        out.push({
          id: `validation-${schema}`,
          name: `${schema} validation`,
          status,
          detail: `${counts.pass} pass · ${counts.fail} fail · ${counts.warn} warn`,
        });
      }
    }

    // Interaction success rate.
    if (interactions.length === 0) {
      out.push({
        id: "interactions-presence",
        name: "Interactions executed",
        status: "warn",
        detail: "No interactions were executed. Check that the page exposes interactive elements that match the detector heuristics.",
      });
    } else {
      const failed = interactions.filter((i) => i.error).length;
      const successPct = Math.round(((interactions.length - failed) / interactions.length) * 100);
      const status: CheckStatus = failed === 0 ? "pass" : successPct >= 80 ? "warn" : "fail";
      out.push({
        id: "interactions-success",
        name: "Interaction success rate",
        status,
        detail: `${interactions.length - failed}/${interactions.length} executed cleanly (${successPct}%). ${failed} errored.`,
      });
    }

    // Coverage.
    if (!coverage || coverage.totalElements === 0) {
      out.push({
        id: "coverage-presence",
        name: "Element coverage",
        status: "info",
        detail: "Coverage snapshot not available for this scan.",
      });
    } else {
      const status: CheckStatus = coverage.coveragePct >= 80 ? "pass" : coverage.coveragePct >= 50 ? "warn" : "fail";
      out.push({
        id: "coverage-pct",
        name: "Element coverage",
        status,
        detail: `${coverage.testedElements}/${coverage.totalElements} interactive elements tested (${coverage.coveragePct}%).`,
      });
    }

    // Journey step health.
    if (journeySteps && journeySteps.length > 0) {
      const completed = journeySteps.filter((s) => s.status === "complete").length;
      const failedSteps = journeySteps.filter((s) => s.status === "failed").length;
      const status: CheckStatus = failedSteps > 0 ? "fail" : completed === journeySteps.length ? "pass" : "warn";
      out.push({
        id: "journey-steps",
        name: "Journey steps",
        status,
        detail: `${completed}/${journeySteps.length} steps completed${failedSteps ? ` · ${failedSteps} failed` : ""}.`,
      });
    }

    return out;
  }, [session, interactions, validation, coverage, journeySteps]);

  return (
    <ul className="space-y-3">
      {checks.map((c) => (
        <li
          key={c.id}
          className="tl-card-enter flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition duration-300 hover:border-white/18 hover:bg-white/[0.07]"
        >
          <div className="pt-1">
            <StatusDot status={c.status} />
          </div>
          <div>
            <p className="font-medium text-white/90">{c.name}</p>
            <p className="mt-1 text-sm text-white/50">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
