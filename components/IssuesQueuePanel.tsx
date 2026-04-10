"use client";

import { useCallback, useMemo, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { buildPrioritizedIssues, type IssueSeverity, type PrioritizedIssue } from "@/lib/issues-engine";
import type { AuditReport } from "@/lib/types";

function severityLabel(s: IssueSeverity): string {
  const map: Record<IssueSeverity, string> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    informational: "FYI",
  };
  return map[s] ?? s;
}

function SeverityChip({ severity }: { severity: IssueSeverity }) {
  const map: Record<IssueSeverity, string> = {
    critical: "bg-rose-500/20 text-rose-200 ring-rose-400/40",
    high: "bg-orange-500/15 text-orange-200 ring-orange-400/35",
    medium: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    low: "bg-sky-500/15 text-sky-200 ring-sky-400/30",
    informational: "bg-slate-500/20 text-slate-300 ring-slate-500/30",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ${map[severity]}`}
    >
      {severityLabel(severity)}
    </span>
  );
}

type JiraConfigured = boolean | null;

export function IssuesQueuePanel({
  report,
  jiraConfigured,
  onRefreshJira,
}: {
  report: AuditReport;
  jiraConfigured: JiraConfigured;
  onRefreshJira?: () => void;
}) {
  const issues = useMemo(() => buildPrioritizedIssues(report), [report]);
  const [posting, setPosting] = useState<number | null>(null);
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [linksByIndex, setLinksByIndex] = useState<Record<number, { key: string; url: string }>>({});

  const logToJira = useCallback(
    async (idx: number, issue: PrioritizedIssue) => {
      setPosting(idx);
      setJiraError(null);
      try {
        const res = await fetch("/api/jira", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ruleId: issue.ruleId,
            title: issue.title,
            detail: issue.detail,
            remediation: issue.remediation,
            severity: issue.severity,
            priority: issue.priority,
            pageTitle: report.snapshot.title,
            pageUrl: report.snapshot.url,
            finalUrl: report.snapshot.finalUrl,
            capturedAt: new Date(report.snapshot.fetchedAt).toISOString(),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          key?: string;
          browseUrl?: string;
          error?: string;
          code?: string;
        };
        if (data.ok === true && data.key && data.browseUrl) {
          setLinksByIndex((prev) => ({ ...prev, [idx]: { key: data.key!, url: data.browseUrl! } }));
          return;
        }
        setJiraError(data.error || "Could not create the Jira issue.");
      } catch {
        setJiraError("Network error while talking to Jira.");
      } finally {
        setPosting(null);
      }
    },
    [report],
  );

  if (issues.length === 0) {
    return (
      <div className="tl-fade-up rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 px-8 py-12 text-center shadow-[0_0_40px_-12px_rgba(52,211,153,0.25)]">
        <p className="font-display text-lg font-semibold text-white">No issues found</p>
        <p className="mt-2 text-sm text-white/60">
          Every automated check passed on this run. Run another page anytime you need a fresh snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/55">
        <span className="font-semibold text-white/90">{issues.length}</span> open finding
        {issues.length === 1 ? "" : "s"}. Start with <span className="text-white/80">P1</span> (most important
        first).
      </p>

      {jiraConfigured === false ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs leading-relaxed text-white/55">
          <span className="font-medium text-white/85">Jira logging is off.</span> Add{" "}
          <code className="text-cyan-300/90">JIRA_HOST</code>, <code className="text-cyan-300/90">JIRA_EMAIL</code>,{" "}
          <code className="text-cyan-300/90">JIRA_API_TOKEN</code>, and{" "}
          <code className="text-cyan-300/90">JIRA_PROJECT_KEY</code> to{" "}
          <code className="text-violet-300/85">.env.local</code>, restart the app, then{" "}
          <button type="button" onClick={() => onRefreshJira?.()} className="font-medium text-cyan-400 underline">
            check again
          </button>
          . Many QA teams send tool findings straight into Jira this way.
        </div>
      ) : null}

      {jiraError ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {jiraError}
        </p>
      ) : null}

      <ul className="space-y-3">
        {issues.map((i, idx) => (
          <li
            key={`${i.ruleId}-${idx}`}
            className="tl-card-enter group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 shadow-lg ring-1 ring-white/[0.04] transition duration-300 hover:-translate-y-0.5 hover:border-violet-400/30 hover:shadow-[0_12px_40px_-16px_rgba(139,92,246,0.25)] hover:ring-violet-400/20"
            style={{ animationDelay: `${Math.min(idx, 12) * 55}ms` }}
          >
            <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl" />
            <div className="relative flex flex-wrap items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-sm font-black text-white shadow-lg shadow-violet-500/25">
                P{i.priority}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityChip severity={i.severity} />
                  <code className="rounded-md bg-black/30 px-2 py-0.5 font-mono text-[11px] text-cyan-200/90">
                    {i.ruleId}
                  </code>
                </div>
                <h4 className="mt-2 font-display text-base font-semibold tracking-tight text-white">{i.title}</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">{i.detail}</p>
                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                  <p className="text-[11px] font-semibold text-cyan-200/90">What to do</p>
                  <p className="mt-1 text-sm leading-relaxed text-cyan-100/90">{i.remediation}</p>
                </div>

                {jiraConfigured === true ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={posting === idx}
                      onClick={() => logToJira(idx, i)}
                      className="rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2 text-xs font-medium text-white transition hover:border-violet-400/40 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {posting === idx ? "Creating in Jira…" : "Create Jira issue"}
                    </button>
                    {linksByIndex[idx] ? (
                      <a
                        href={linksByIndex[idx].url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-cyan-400 underline hover:text-cyan-300"
                      >
                        Open {linksByIndex[idx].key}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-white/35">
        {APP_NAME} does not change your site. It records one browser snapshot—useful the same way manual tag checks
        and automated smoke tests feed into release decisions.
      </p>
    </div>
  );
}
