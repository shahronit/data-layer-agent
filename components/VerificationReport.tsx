"use client";

import { useMemo, type ReactNode } from "react";
import { buildDetailedReportModel } from "@/lib/detailed-report-model";
import { buildPrioritizedIssues } from "@/lib/issues-engine";
import type { AuditReport } from "@/lib/types";

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pass: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    warn: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
    fail: "bg-rose-500/15 text-rose-200 ring-rose-400/30",
    info: "bg-violet-500/15 text-violet-200 ring-violet-400/25",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${map[status] || "text-slate-400 ring-slate-500/30"}`}
    >
      {status}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-cyan-300">
      <span className="h-px flex-1 max-w-8 bg-gradient-to-r from-violet-500/60 to-transparent" />
      {children}
      <span className="h-px flex-1 bg-gradient-to-l from-cyan-500/50 to-transparent" />
    </h3>
  );
}

export function VerificationReport({ report }: { report: AuditReport }) {
  const m = useMemo(() => buildDetailedReportModel(report), [report]);
  const issues = useMemo(() => buildPrioritizedIssues(report), [report]);

  return (
    <div className="space-y-10 pb-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-950/80 via-slate-950/90 to-cyan-950/60 px-6 py-8 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-300/80">
          Full report
        </p>
        <h2 className="relative mt-2 font-display text-xl font-bold tracking-tight text-white">
          Snapshot details
        </h2>
        <p className="relative mt-2 text-sm text-white/55">
          {m.toolName} · {m.generatedAtDisplay}
        </p>
      </div>

      <section>
        <SectionTitle>Open issues</SectionTitle>
        {issues.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-6 text-center text-sm text-emerald-200/80">
            No open issues—all checks passed.
          </div>
        ) : (
          <ol className="space-y-3">
            {issues.map((i, idx) => (
              <li
                key={idx}
                className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-cyan-600 text-xs font-black text-white">
                  P{i.priority}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-rose-300/90">
                    {i.severity}
                  </span>
                  <p className="font-medium text-white/90">{i.title}</p>
                  <p className="mt-1 text-white/50">{i.detail}</p>
                  <p className="mt-2 text-xs text-cyan-200/80">
                    <span className="font-semibold text-cyan-400/90">Fix: </span>
                    {i.remediation}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <SectionTitle>Page details</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-white/10">
              <tr>
                <th className="w-[180px] whitespace-nowrap bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Address you entered
                </th>
                <td className="break-all px-4 py-3 font-mono text-xs text-cyan-200/80">{m.page.requestedUrl}</td>
              </tr>
              <tr>
                <th className="bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Final address
                </th>
                <td className="break-all px-4 py-3 font-mono text-xs">
                  <a href={m.page.resolvedUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                    {m.page.resolvedUrl}
                  </a>
                </td>
              </tr>
              <tr>
                <th className="bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Page title
                </th>
                <td className="px-4 py-3 text-white/80">{m.page.title}</td>
              </tr>
              <tr>
                <th className="bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  When captured
                </th>
                <td className="px-4 py-3 text-white/80">{m.page.capturedAtDisplay}</td>
              </tr>
              <tr>
                <th className="bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Load time
                </th>
                <td className="px-4 py-3 text-white/80">{m.page.loadMs.toLocaleString()} ms</td>
              </tr>
              {m.page.pageError ? (
                <tr>
                  <th className="bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-rose-300/80">
                    Load error
                  </th>
                  <td className="px-4 py-3 text-rose-200/90">{m.page.pageError}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle>Summary</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Score", m.summary.score],
            ["Pass", m.summary.passCount],
            ["Warn", m.summary.warnCount],
            ["Fail", m.summary.failCount],
            ["Info", m.summary.infoCount],
            ["Rules", m.summary.totalChecks],
          ].map(([lbl, val]) => (
            <div
              key={String(lbl)}
              className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent px-3 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">{lbl}</p>
              <p className="mt-1 bg-gradient-to-r from-white to-white/70 bg-clip-text font-display text-2xl font-bold text-transparent">
                {val}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm leading-relaxed text-white/75">{m.summary.executiveParagraph}</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/40">Next steps</p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-white/55">
            {m.summary.recommendations.map((r, i) => (
              <li key={i} className="leading-relaxed">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionTitle>Check results</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.06]">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-white/45">ID</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-white/45">Check</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-white/45">Result</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-white/45">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {m.checks.map((c) => (
                <tr key={c.id} className="bg-white/[0.02] hover:bg-white/[0.05]">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-violet-300/90">{c.id}</td>
                  <td className="px-4 py-3 font-medium text-white/90">{c.name}</td>
                  <td className="px-4 py-3">
                    <Badge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-white/50">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle>dataLayer</SectionTitle>
        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
          <span className="text-white/90">Entries:</span> {m.snapshot.dataLayerLength}
          <span className="mx-2 text-white/20">|</span>
          <span className="text-white/90">Inline GTM IDs:</span>{" "}
          {m.snapshot.gtmContainerIds.length ? m.snapshot.gtmContainerIds.join(", ") : "—"}
        </div>
        {m.snapshot.dataLayerRows.length ? (
          <div className="space-y-2">
            {m.snapshot.dataLayerRows.map((row) => (
              <div key={row.index} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <div className="border-b border-white/10 bg-white/[0.05] px-4 py-2 font-mono text-xs text-white/45">
                  dataLayer[{row.index}]
                </div>
                <pre className="max-h-56 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-white/55 report-scroll">
                  {row.json}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/45">
            No <code className="text-cyan-300/80">window.dataLayer</code> entries at capture time.
          </div>
        )}
      </section>

      <section>
        <SectionTitle>digitalData</SectionTitle>
        <pre className="max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-white/55 report-scroll">
          {m.snapshot.digitalDataJson}
        </pre>
      </section>

      <section>
        <SectionTitle>Tag command queue</SectionTitle>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-white/75">
          <code className="text-violet-300">window._satellite</code> present:{" "}
          <strong className="text-white">{m.snapshot.adobeSatellitePresent ? "Yes" : "No"}</strong>
          {report.snapshot.satelliteTrackEventsObserved &&
          report.snapshot.satelliteTrackEventsObserved.length > 0 ? (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                _satellite.track observed this run
              </p>
              <p className="mt-2 font-mono text-xs text-cyan-200/85">
                {report.snapshot.satelliteTrackEventsObserved.join(", ")}
              </p>
              <p className="mt-2 text-xs text-white/40">
                Includes hooks from a single page load; SPA route changes need a separate capture per view.
              </p>
            </div>
          ) : m.snapshot.adobeSatellitePresent ? (
            <p className="mt-2 text-xs text-white/45">No _satellite.track calls were captured in this wait window.</p>
          ) : null}
        </div>
      </section>

      <section>
        <SectionTitle>Network (tag / analytics samples)</SectionTitle>
        <p className="mb-3 text-xs text-white/45">
          Finished requests that look like analytics or tag beacons (URL heuristics). Status codes come from the browser
          network stack.
        </p>
        {(report.snapshot.networkRequests?.length ?? 0) > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.06]">
                  {["Status", "Method", "Type", "URL"].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-bold uppercase text-white/45">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {report.snapshot.networkRequests!.map((n, i) => (
                  <tr key={i} className="bg-white/[0.02]">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{n.status}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{n.method}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-white/60">{n.resourceType}</td>
                    <td className="max-w-0 px-3 py-2">
                      <span className="block truncate font-mono text-xs text-cyan-200/85" title={n.url}>
                        {n.url}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/45">
            No matching requests in this capture window.
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Adobe Analytics hits (decoded)</SectionTitle>
        <p className="mb-3 text-xs text-white/45">
          AppMeasurement-style <code className="text-cyan-300/80">/b/ss/</code> URLs and selected Adobe collection hosts:
          query string and <code className="text-cyan-300/80">application/x-www-form-urlencoded</code> POST bodies are
          parsed into keys (eVars, props, events, pageName, etc.). This is not Adobe Admin validation—processing rules,
          Vista, and report-suite
          config require Adobe’s tools or APIs; compare hits with{" "}
          <a
            className="text-cyan-400 underline"
            href="https://experienceleague.adobe.com/docs/debugger/using/experience-cloud-debugger.html"
            target="_blank"
            rel="noreferrer"
          >
            Experience Platform Debugger
          </a>{" "}
          for full mapping.
        </p>
        {(report.snapshot.adobeAnalyticsHits?.length ?? 0) > 0 ? (
          <div className="space-y-6">
            {report.snapshot.adobeAnalyticsHits!.map((hit, hi) => (
              <div
                key={hi}
                className="overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.04]"
              >
                <div className="border-b border-white/10 bg-white/[0.06] px-4 py-3">
                  <p className="font-mono text-[11px] text-amber-200/90">
                    {hit.method} · HTTP {hit.status}
                    {hit.reportSuites?.length ? (
                      <span className="ml-2 text-white/60">
                        · report suite(s): {hit.reportSuites.join(", ")}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-cyan-200/75" title={hit.urlShort}>
                    {hit.urlShort}
                  </p>
                  {hit.truncatedParams || hit.paramCount > hit.params.length ? (
                    <p className="mt-2 text-[11px] text-white/45">
                      Showing {hit.params.length} of {hit.paramCount} parameter keys (truncated for size).
                    </p>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-black/30">
                        <th className="px-3 py-2 text-xs font-bold uppercase text-white/45">Key</th>
                        <th className="px-3 py-2 text-xs font-bold uppercase text-white/45">Hint</th>
                        <th className="px-3 py-2 text-xs font-bold uppercase text-white/45">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {hit.params.map((row, ri) => (
                        <tr key={`${row.key}-${ri}`} className="bg-white/[0.02]">
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-violet-300/90">
                            {row.key}
                          </td>
                          <td className="px-3 py-2 text-xs text-white/50">{row.label ?? "—"}</td>
                          <td className="max-w-0 px-3 py-2">
                            <span className="block break-all font-mono text-xs text-white/70">{row.value}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/45">
            No Adobe Analytics collection URLs matched in this capture (or payload was not decodable as query /
            urlencoded form).
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Failed resource requests</SectionTitle>
        <p className="mb-3 text-xs text-white/45">
          Scripts, stylesheets, XHR, or fetch that failed to complete (blocked, DNS, TLS, etc.).
        </p>
        {(report.snapshot.failedRequests?.length ?? 0) > 0 ? (
          <ul className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            {report.snapshot.failedRequests!.map((f, i) => (
              <li key={i} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <p className="break-all font-mono text-xs text-cyan-200/80">{f.url}</p>
                <p className="mt-1 text-xs text-rose-200/90">{f.error}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/45">None observed.</div>
        )}
      </section>

      <section>
        <SectionTitle>Storage key names</SectionTitle>
        <p className="mb-3 text-xs text-white/45">
          Key names only from <code className="text-cyan-300/80">localStorage</code> and{" "}
          <code className="text-cyan-300/80">sessionStorage</code> (values are not read).
        </p>
        {report.snapshot.storageKeysSample ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-white/45">
                localStorage ({report.snapshot.storageKeysSample.localStorage.length})
              </p>
              {report.snapshot.storageKeysSample.localStorage.length ? (
                <ul className="report-scroll mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-white/65">
                  {report.snapshot.storageKeysSample.localStorage.map((k) => (
                    <li key={k} className="break-all">
                      {k}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-white/45">Empty.</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-white/45">
                sessionStorage ({report.snapshot.storageKeysSample.sessionStorage.length})
              </p>
              {report.snapshot.storageKeysSample.sessionStorage.length ? (
                <ul className="report-scroll mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-white/65">
                  {report.snapshot.storageKeysSample.sessionStorage.map((k) => (
                    <li key={k} className="break-all">
                      {k}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-white/45">Empty.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/45">
            No storage sample for this run.
          </div>
        )}
      </section>

      {report.snapshot.interactiveGapSamples && report.snapshot.interactiveGapSamples.length > 0 ? (
        <section>
          <SectionTitle>Clickables missing both attributes</SectionTitle>
          <p className="mb-3 text-xs text-white/45">
            Sample only (max 18). Spec: add <code className="text-cyan-300/80">data-track</code> and{" "}
            <code className="text-cyan-300/80">data-track-id</code> unless the page excludes that control.
          </p>
          <ul className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
            {report.snapshot.interactiveGapSamples.map((g, i) => (
              <li key={i}>
                <span className="font-mono text-violet-300/90">&lt;{g.tag}&gt;</span> {g.textSnippet}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionTitle>data-track attributes</SectionTitle>
        <p className="mb-3 text-xs text-white/45">
          Sample of elements with tracking attributes (limited count per run).
        </p>
        {m.snapshot.trackedElements.length ? (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.06]">
                  {["Tag", "data-track", "data-track-id", "removal", "product-id", "Snippet"].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-bold uppercase text-white/45">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {m.snapshot.trackedElements.map((t, i) => (
                  <tr key={i} className="bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-xs">{t.tag}</td>
                    <td className="px-3 py-2 font-mono text-xs text-cyan-300/80">{t.dataTrack ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.dataTrackId ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.dataTrackRemoval ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.dataProductId ?? "—"}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-white/45" title={t.textSnippet}>
                      {t.textSnippet || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/45">
            No tracked attributes in the sampled set.
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Browser messages</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-white/45">
              Console ({m.snapshot.consoleErrors.length})
            </p>
            {m.snapshot.consoleErrors.length ? (
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto font-mono text-xs text-amber-200/80 report-scroll">
                {m.snapshot.consoleErrors.map((e, i) => (
                  <li key={i} className="break-words">
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-white/45">None.</p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-white/45">
              Page exceptions ({m.snapshot.pageErrors.length})
            </p>
            {m.snapshot.pageErrors.length ? (
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto font-mono text-xs text-rose-200/80 report-scroll">
                {m.snapshot.pageErrors.map((e, i) => (
                  <li key={i} className="break-words">
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-white/45">None.</p>
            )}
          </div>
        </div>
      </section>

      <p className="border-t border-white/10 pt-6 text-center text-xs text-white/35">
        Single snapshot · {m.generatedAtIso}
      </p>
    </div>
  );
}
