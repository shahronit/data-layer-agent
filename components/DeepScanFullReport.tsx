"use client";

import { CoverageReport } from "./CoverageReport";
import { ValidationResults } from "./ValidationResults";
import { DeepScanIssues } from "./DeepScanIssues";
import { DeepScanChecks } from "./DeepScanChecks";

interface Session {
  id?: string;
  url?: string;
  score?: number | null;
  status?: string;
  started_at?: string | null;
  finished_at?: string | null;
  mode?: string | null;
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

interface ValidationEntry {
  id: string;
  schema_name: string;
  status: string;
  errors: Array<{ field: string; message: string; severity: string }>;
}

interface CoverageData {
  totalElements: number;
  testedElements: number;
  coveragePct: number;
  untestedElements: Array<{ selector: string; tag: string; text: string; category: string }>;
}

interface JourneyStep {
  step_index: number;
  url: string;
  label: string | null;
  status: string;
  action_type: string | null;
}

interface Props {
  session: Session | null;
  interactions: InteractionEntry[];
  validation: { results: ValidationEntry[]; summary: { pass: number; fail: number; warn: number } } | null;
  coverage: CoverageData | null;
  journeySteps: JourneyStep[] | null;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <header>
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/60">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-white/40">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function DeepScanFullReport({ session, interactions, validation, coverage, journeySteps }: Props) {
  const failed = interactions.filter((i) => i.error).length;
  const successPct = interactions.length === 0 ? 0 : Math.round(((interactions.length - failed) / interactions.length) * 100);
  const duration =
    session?.started_at && session?.finished_at
      ? Math.max(0, new Date(session.finished_at).getTime() - new Date(session.started_at).getTime())
      : null;

  return (
    <div className="space-y-8">
      <Section title="Summary" subtitle="High-level signals from this deep scan">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Score</p>
            <p className="mt-1 text-xl font-semibold text-white">{session?.score ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Interactions</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {interactions.length} <span className="text-xs font-normal text-white/45">({successPct}% ok)</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Coverage</p>
            <p className="mt-1 text-xl font-semibold text-white">{coverage ? `${coverage.coveragePct}%` : "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Validation</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {validation ? `${validation.summary.pass} / ${validation.summary.fail}` : "—"}
              {validation ? <span className="ml-1 text-xs font-normal text-white/45">pass / fail</span> : null}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/45">
          <span>URL: {session?.url ?? "—"}</span>
          {duration !== null ? <span>Duration: {(duration / 1000).toFixed(1)}s</span> : null}
          {session?.mode ? <span>Mode: {session.mode}</span> : null}
        </div>
      </Section>

      <Section title="Health checks" subtitle="Synthesized pass/warn/fail signals across schemas, coverage and execution">
        <DeepScanChecks
          session={session}
          interactions={interactions}
          validation={validation}
          coverage={coverage}
          journeySteps={journeySteps}
        />
      </Section>

      <Section title="Issues" subtitle="Top problems detected during this scan">
        <DeepScanIssues
          session={session ?? null}
          interactions={interactions}
          validation={validation as Parameters<typeof DeepScanIssues>[0]["validation"]}
          coverage={coverage}
        />
      </Section>

      <Section title="Validation" subtitle="Per-schema results">
        {validation && validation.results.length > 0 ? (
          <ValidationResults
            results={validation.results as Parameters<typeof ValidationResults>[0]["results"]}
            summary={validation.summary}
          />
        ) : (
          <p className="text-sm text-white/45">No validation results recorded.</p>
        )}
      </Section>

      <Section title="Coverage" subtitle="Element coverage breakdown">
        <CoverageReport data={coverage} />
      </Section>

      {journeySteps && journeySteps.length > 0 ? (
        <Section title="Journey steps" subtitle={`${journeySteps.length} step(s) in this journey`}>
          <ol className="space-y-2">
            {journeySteps.map((s) => (
              <li
                key={`${s.step_index}-${s.url}`}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
              >
                <span className="font-mono text-white/35">#{s.step_index + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-white/85">{s.label || s.url}</p>
                  <p className="text-white/40">{s.url}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    s.status === "complete"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : s.status === "failed"
                      ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                      : "border-white/15 bg-white/5 text-white/55"
                  }`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  );
}
