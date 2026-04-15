"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { BrandMark } from "@/components/BrandMark";
import { EmptyStateHero } from "@/components/EmptyStateHero";
import { IssuesQueuePanel } from "@/components/IssuesQueuePanel";
import { ReportMarkdown } from "@/components/ReportMarkdown";
import { TabStrip } from "@/components/TabStrip";
import { VerificationReport } from "@/components/VerificationReport";
import { DEFAULT_AI_CHAT_RULES } from "@/lib/ai-report-defaults";
import { APP_NAME, APP_TAGLINE, exportFilename } from "@/lib/brand";
import { detailedReportToHtml } from "@/lib/detailed-report-html";
import { issuesToCsv, issuesToMarkdown, buildPrioritizedIssues } from "@/lib/issues-engine";
import type { AuditBatchResultItem, AuditReport, CapturedEventSource } from "@/lib/types";
import { buildEventStreamSummary, type EventGroup, type EventStreamSummary } from "@/lib/event-grouping";

type Tab = "issues" | "events" | "checks" | "detailed" | "raw" | "ai";

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    pass: "bg-emerald-400 shadow-emerald-400/50",
    warn: "bg-amber-400 shadow-amber-400/40",
    fail: "bg-rose-400 shadow-rose-400/50",
    info: "bg-violet-400 shadow-violet-400/40",
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shadow-[0_0_10px] ${map[status] || "bg-slate-500"}`}
    />
  );
}

function ScoreRing({ score }: { score: number }) {
  const s = Math.min(100, Math.max(0, score));
  const deg = s * 3.6;
  return (
    <div
      className="tl-score-ring-anim relative h-[7.5rem] w-[7.5rem] shrink-0 rounded-full p-[3px]"
      style={{
        background: `conic-gradient(from 210deg, #a78bfa ${deg}deg, rgba(255,255,255,0.08) ${deg}deg)`,
      }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#0c0c12]">
        <span className="bg-gradient-to-br from-white to-slate-400 bg-clip-text font-display text-3xl font-bold tracking-tight text-transparent">
          {score}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Score</span>
      </div>
    </div>
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const MAX_URLS_PER_RUN = 10;

const ES_SOURCE_COLORS: Record<CapturedEventSource, string> = {
  dataLayer: "bg-blue-500/15 text-blue-200 ring-blue-400/30",
  digitalData: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
  satellite: "bg-violet-500/15 text-violet-200 ring-violet-400/25",
  network: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
};

function EsSourceBadge({ source }: { source: CapturedEventSource }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${ES_SOURCE_COLORS[source]}`}
    >
      {source}
    </span>
  );
}

function EsGroupCard({ group }: { group: EventGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="tl-card-enter overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.05]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/80 to-cyan-600/80 text-xs font-bold text-white">
          {group.occurrences}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white/90">{group.eventName}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {group.sources.map((s) => (
              <EsSourceBadge key={s.source} source={s.source} />
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-white/40">
            {(group.firstSeen / 1000).toFixed(1)}s
            {group.firstSeen !== group.lastSeen && ` \u2013 ${(group.lastSeen / 1000).toFixed(1)}s`}
          </p>
        </div>
        <span className={`text-white/40 transition ${open ? "rotate-90" : ""}`}>{"\u25B6"}</span>
      </button>
      {open && (
        <div className="border-t border-white/10 bg-black/20">
          {group.sources.map((src) => (
            <div key={src.source} className="border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2 px-4 py-2 text-xs text-white/50">
                <EsSourceBadge source={src.source} />
                <span>
                  {src.count} event{src.count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-1 px-4 pb-3">
                {src.events.map((ev, i) => {
                  const payloadStr = JSON.stringify(ev.payload, null, 2);
                  return (
                    <EsEventRow key={i} timestamp={ev.timestamp} pageUrl={ev.pageUrl} payloadStr={payloadStr} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EsEventRow({
  timestamp,
  pageUrl,
  payloadStr,
}: {
  timestamp: number;
  pageUrl: string;
  payloadStr: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = payloadStr.length > 140;

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="font-mono text-white/50">{(timestamp / 1000).toFixed(2)}s</span>
        <span className="truncate text-cyan-200/70" title={pageUrl}>
          {pageUrl}
        </span>
      </div>
      <pre
        className={`mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed text-white/55 ${
          !expanded && isLong ? "max-h-16 overflow-hidden" : ""
        }`}
      >
        {payloadStr}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-[10px] font-medium text-cyan-400 hover:underline"
        >
          {expanded ? "Collapse" : "Show full payload"}
        </button>
      )}
    </div>
  );
}

function EventStreamTab({ report }: { report: AuditReport }) {
  const summary = useMemo(
    () => buildEventStreamSummary(report.snapshot.eventStream ?? []),
    [report],
  );
  const [filter, setFilter] = useState<CapturedEventSource | "all">("all");

  const filteredGroups = useMemo(
    () =>
      filter === "all"
        ? summary.groups
        : summary.groups
            .map((g) => ({
              ...g,
              sources: g.sources.filter((s) => s.source === filter),
              occurrences: g.sources
                .filter((s) => s.source === filter)
                .reduce((sum, s) => sum + s.count, 0),
            }))
            .filter((g) => g.sources.length > 0),
    [summary, filter],
  );

  const fmtDuration =
    summary.captureDurationMs >= 60_000
      ? `${(summary.captureDurationMs / 60_000).toFixed(1)} min`
      : `${(summary.captureDurationMs / 1000).toFixed(1)}s`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Total events", String(summary.totalEvents)],
            ["Unique names", String(summary.uniqueNames)],
            ["Capture duration", fmtDuration],
            [
              "Sources",
              Object.entries(summary.bySource)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ") || "none",
            ],
          ] as const
        ).map(([lbl, val]) => (
          <div
            key={lbl}
            className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent px-3 py-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">{lbl}</p>
            <p className="mt-1 bg-gradient-to-r from-white to-white/70 bg-clip-text text-sm font-bold text-transparent">
              {val}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "dataLayer", "digitalData", "satellite", "network"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "border-violet-400/50 bg-violet-500/20 text-white shadow-[0_0_12px_-4px_rgba(139,92,246,0.5)]"
                : "border-white/15 text-white/50 hover:border-white/25 hover:bg-white/[0.06]"
            }`}
          >
            {f === "all" ? "All sources" : f}
            {f !== "all" && summary.bySource[f] > 0 && (
              <span className="ml-1 text-white/35">({summary.bySource[f]})</span>
            )}
          </button>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 px-6 py-8 text-center text-sm text-white/45">
          No events match the selected filter.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((g) => (
            <EsGroupCard key={g.eventName} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function parseCookiesFromText(text: string): Array<{ name: string; value: string; domain?: string; path?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((c) => c && typeof c === "object" && typeof c.name === "string" && typeof c.value === "string")
        .map((c) => ({ name: c.name, value: String(c.value), domain: c.domain, path: c.path }));
    }
  } catch {
    /* not JSON — try semicolon-separated format */
  }

  return trimmed
    .split(/;\s*/)
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx < 1) return null;
      return { name: pair.slice(0, eqIdx).trim(), value: pair.slice(eqIdx + 1).trim() };
    })
    .filter((c): c is { name: string; value: string } => c !== null);
}

function parseUrlsFromText(text: string): string[] {
  const lines = text
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (!isValidHttpUrl(line)) continue;
    const n = line.trim();
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= MAX_URLS_PER_RUN) break;
  }
  return out;
}

export default function HomePage() {
  const [urlsInput, setUrlsInput] = useState("");
  const [waitMs, setWaitMs] = useState(3000);
  const [navTimeoutMs, setNavTimeoutMs] = useState(45_000);
  const [customRules, setCustomRules] = useState(DEFAULT_AI_CHAT_RULES);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<AuditBatchResultItem[] | null>(null);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(0);
  const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("issues");
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);
  const [jiraConfigured, setJiraConfigured] = useState<boolean | null>(null);
  const [adobeIntegration, setAdobeIntegration] = useState<{
    analytics2: { configured: boolean };
    tagsReactor: { configured: boolean };
    limitations: Record<string, string>;
    docs: Record<string, string>;
  } | null>(null);
  const [adobeRsid, setAdobeRsid] = useState("");
  const [adobePropertyOverride, setAdobePropertyOverride] = useState("");
  const [adobePanelBusy, setAdobePanelBusy] = useState(false);
  const [adobePanelError, setAdobePanelError] = useState<string | null>(null);
  const [adobePanelJson, setAdobePanelJson] = useState<string | null>(null);
  const [loginSessionId, setLoginSessionId] = useState<string | null>(null);
  const [loginWaiting, setLoginWaiting] = useState(false);
  const [loginPageTitle, setLoginPageTitle] = useState<string | null>(null);
  const [loginSessionUrls, setLoginSessionUrls] = useState<string[]>([]);
  const [cookiesInput, setCookiesInput] = useState("");

  const parsedUrls = useMemo(() => parseUrlsFromText(urlsInput), [urlsInput]);
  const urlsValid = parsedUrls.length > 0;

  const report = useMemo((): AuditReport | null => {
    if (!batchResults?.length) return null;
    const item = batchResults[selectedBatchIndex];
    if (!item?.ok || !item.report) return null;
    return item.report;
  }, [batchResults, selectedBatchIndex]);

  const suggestedAdobeRsid = useMemo(() => {
    const suites = report?.snapshot.adobeAnalyticsHits?.flatMap((h) => h.reportSuites ?? []) ?? [];
    return suites[0] ?? "";
  }, [report]);

  const fetchAdobeReportSuiteSettings = useCallback(async () => {
    const rsid = adobeRsid.trim() || suggestedAdobeRsid;
    if (!rsid) {
      setAdobePanelError("Enter an RSID or run a scan that captures an Adobe /b/ss/ hit first.");
      return;
    }
    setAdobePanelBusy(true);
    setAdobePanelError(null);
    try {
      const res = await fetch("/api/adobe/analytics/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsid, includeMetadata: true }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      setAdobePanelJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setAdobePanelError(e instanceof Error ? e.message : String(e));
      setAdobePanelJson(null);
    } finally {
      setAdobePanelBusy(false);
    }
  }, [adobeRsid, suggestedAdobeRsid]);

  const fetchAdobeTagsRules = useCallback(async () => {
    setAdobePanelBusy(true);
    setAdobePanelError(null);
    try {
      const q = adobePropertyOverride.trim();
      const url = q
        ? `/api/adobe/tags/rules?propertyId=${encodeURIComponent(q)}`
        : "/api/adobe/tags/rules";
      const res = await fetch(url);
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      setAdobePanelJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setAdobePanelError(e instanceof Error ? e.message : String(e));
      setAdobePanelJson(null);
    } finally {
      setAdobePanelBusy(false);
    }
  }, [adobePropertyOverride]);

  const fetchAdobeTagsExtensions = useCallback(async () => {
    setAdobePanelBusy(true);
    setAdobePanelError(null);
    try {
      const q = adobePropertyOverride.trim();
      const url = q
        ? `/api/adobe/tags/extensions?propertyId=${encodeURIComponent(q)}`
        : "/api/adobe/tags/extensions";
      const res = await fetch(url);
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      setAdobePanelJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setAdobePanelError(e instanceof Error ? e.message : String(e));
      setAdobePanelJson(null);
    } finally {
      setAdobePanelBusy(false);
    }
  }, [adobePropertyOverride]);

  useEffect(() => {
    setAiMarkdown(null);
    setAiError(null);
  }, [selectedBatchIndex]);

  useEffect(() => {
    if (!batchResults?.length) return;
    if (selectedBatchIndex >= batchResults.length) setSelectedBatchIndex(0);
  }, [batchResults, selectedBatchIndex]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => {
        if (!cancelled) setApiOk(r.ok);
      })
      .catch(() => {
        if (!cancelled) setApiOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/adobe/integration")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d === "object") setAdobeIntegration(d);
      })
      .catch(() => {
        if (!cancelled) setAdobeIntegration(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshGeminiConfigured = useCallback(() => {
    fetch("/api/analyze", {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        setGeminiConfigured(Boolean(d.configured));
      })
      .catch(() => {
        setGeminiConfigured(false);
      });
  }, []);

  const refreshJiraConfigured = useCallback(() => {
    fetch("/api/jira", {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        setJiraConfigured(Boolean(d.configured));
      })
      .catch(() => {
        setJiraConfigured(false);
      });
  }, []);

  useEffect(() => {
    refreshGeminiConfigured();
    refreshJiraConfigured();
  }, [refreshGeminiConfigured, refreshJiraConfigured]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refreshGeminiConfigured();
        refreshJiraConfigured();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshGeminiConfigured, refreshJiraConfigured]);

  useEffect(() => {
    try {
      const v = localStorage.getItem("layerlens-sidebar-collapsed");
      if (v !== null) setSidebarCollapsed(v === "1");
      else if (typeof window !== "undefined" && window.innerWidth < 1280) setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
    setSidebarHydrated(true);
  }, []);

  useEffect(() => {
    if (!sidebarHydrated) return;
    try {
      localStorage.setItem("layerlens-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed, sidebarHydrated]);

  const runAudit = useCallback(async () => {
    if (!urlsValid) {
      setError(`Add at least one valid URL (one per line, up to ${MAX_URLS_PER_RUN}).`);
      return;
    }
    setLoading(true);
    setError(null);
    setAiMarkdown(null);
    setAiError(null);
    setLoginSessionId(null);
    setLoginWaiting(false);
    setLoginPageTitle(null);
    setLoginSessionUrls([]);
    try {
      const parsedCookies = parseCookiesFromText(cookiesInput);
      const body =
        parsedUrls.length === 1
          ? {
              url: parsedUrls[0],
              waitAfterLoadMs: waitMs,
              navigationTimeoutMs: navTimeoutMs,
              openForLogin: true,
              ...(parsedCookies.length > 0 ? { cookies: parsedCookies } : {}),
            }
          : {
              urls: parsedUrls,
              waitAfterLoadMs: waitMs,
              navigationTimeoutMs: navTimeoutMs,
              openForLogin: true,
              ...(parsedCookies.length > 0 ? { cookies: parsedCookies } : {}),
            };

      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        phase?: string;
        sessionId?: string;
        loginDetected?: boolean;
        pageTitle?: string;
        currentUrl?: string;
        urls?: string[];
        results?: AuditBatchResultItem[];
        error?: string;
        hints?: string[];
        headedUnavailable?: boolean;
        cookiesApplied?: boolean;
      };
      if (!res.ok) {
        const hintBlock = Array.isArray(data.hints) ? `\n\n${data.hints.join("\n")}` : "";
        setError((data.error || "Check failed") + hintBlock);
        setBatchResults(null);
        return;
      }

      if (data.phase === "login" && data.sessionId) {
        setLoginSessionId(data.sessionId);
        setLoginWaiting(true);
        setLoginPageTitle(data.pageTitle ?? null);
        setLoginSessionUrls(data.urls ?? parsedUrls);
        setLoading(false);
        return;
      }

      if (data.headedUnavailable) {
        setError(
          "Server mode: the audit ran in headless mode (no interactive browser). " +
          "To audit login-protected pages, paste your auth cookies below and re-run."
        );
      } else if (data.cookiesApplied) {
        setError(null);
      }

      const results = data.results;
      if (!Array.isArray(results) || results.length === 0) {
        setError("Unexpected response from server.");
        setBatchResults(null);
        return;
      }
      setBatchResults(results);
      const firstOk = results.findIndex((r) => r.ok && r.report);
      setSelectedBatchIndex(firstOk >= 0 ? firstOk : 0);
      setTab("issues");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBatchResults(null);
    } finally {
      setLoading(false);
    }
  }, [parsedUrls, urlsValid, waitMs, navTimeoutMs, cookiesInput]);

  const continueAfterLogin = useCallback(async (sessionIdOverride?: string) => {
    const sid = sessionIdOverride ?? loginSessionId;
    if (!sid) return;
    setLoading(true);
    setLoginWaiting(false);
    setError(null);
    try {
      const continueBody: Record<string, unknown> = {
        sessionId: sid,
        action: "continue",
        waitAfterLoadMs: waitMs,
        navigationTimeoutMs: navTimeoutMs,
      };
      if (loginSessionUrls.length > 1) {
        continueBody.urls = loginSessionUrls;
      }
      const res = await fetch("/api/audit/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(continueBody),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        results?: AuditBatchResultItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Audit failed after login.");
        setBatchResults(null);
        return;
      }
      const results = data.results;
      if (!Array.isArray(results) || results.length === 0) {
        setError("Unexpected response from server.");
        setBatchResults(null);
        return;
      }
      setBatchResults(results);
      const firstOk = results.findIndex((r) => r.ok && r.report);
      setSelectedBatchIndex(firstOk >= 0 ? firstOk : 0);
      setTab("issues");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBatchResults(null);
    } finally {
      setLoading(false);
      setLoginSessionId(null);
      setLoginPageTitle(null);
      setLoginSessionUrls([]);
    }
  }, [loginSessionId, loginSessionUrls, waitMs, navTimeoutMs]);

  const cancelLogin = useCallback(async () => {
    if (!loginSessionId) return;
    try {
      await fetch("/api/audit/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: loginSessionId, action: "cancel" }),
      });
    } catch {
      /* best effort */
    }
    setLoginSessionId(null);
    setLoginWaiting(false);
    setLoginPageTitle(null);
    setLoading(false);
  }, [loginSessionId]);

  const exportMarkdown = useCallback(() => {
    if (!aiMarkdown) return;
    const blob = new Blob([aiMarkdown], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportFilename("ai")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [aiMarkdown]);

  const exportDetailedHtml = useCallback(() => {
    if (!report) return;
    const html = detailedReportToHtml(report);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportFilename("report")}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [report]);

  const exportIssuesMd = useCallback(() => {
    if (!report) return;
    const md = issuesToMarkdown(buildPrioritizedIssues(report), report);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportFilename("issues")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [report]);

  const exportIssuesCsv = useCallback(() => {
    if (!report) return;
    const csv = issuesToCsv(buildPrioritizedIssues(report));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportFilename("issues")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [report]);

  const exportJson = useCallback(() => {
    if (!report) return;
    const enriched = {
      ...report,
      prioritizedIssues: buildPrioritizedIssues(report),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportFilename("audit")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [report]);

  const runAi = useCallback(async () => {
    if (!report) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report,
          customRules: customRules.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        code?: string;
        message?: string;
        markdown?: string;
        error?: string;
      };

      if (data.ok === true && typeof data.markdown === "string") {
        setAiMarkdown(data.markdown);
        setGeminiConfigured(true);
        setTab("ai");
        return;
      }

      if (data.code === "GEMINI_NOT_CONFIGURED") {
        setGeminiConfigured(false);
        return;
      }

      setAiError(data.error || data.message || "AI report failed");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  }, [report, customRules]);

  const hasEventStream = Boolean(
    report?.snapshot.eventStream && report.snapshot.eventStream.length > 0,
  );

  const tabDefs = useMemo(
    () =>
      [
        { id: "issues" as const, label: "Issues" },
        ...(hasEventStream ? [{ id: "events" as const, label: "Events" }] : []),
        { id: "checks" as const, label: "All checks" },
        { id: "detailed" as const, label: "Full report" },
        { id: "raw" as const, label: "Raw data" },
        { id: "ai" as const, label: "AI report" },
      ] as const,
    [hasEventStream],
  );

  return (
    <div className="relative flex h-dvh max-h-dvh overflow-hidden">
      <AmbientBackground />

      <aside
        className={`tl-glass report-scroll flex h-full shrink-0 flex-col overflow-y-auto border-r border-white/10 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] transition-[width] duration-300 ease-out ${
          sidebarCollapsed ? "w-[4.25rem]" : "w-[17rem]"
        }`}
      >
        <div className={`border-b border-white/10 ${sidebarCollapsed ? "px-2 py-4" : "px-5 py-6"}`}>
          <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-3" : "gap-3"}`}>
            <BrandMark compact={sidebarCollapsed} />
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="font-display text-sm font-bold tracking-tight text-white">{APP_NAME}</p>
                <p className="text-[11px] text-white/45">{APP_TAGLINE}</p>
              </div>
            ) : null}
          </div>
        </div>
        {!sidebarCollapsed ? (
          <nav className="flex flex-1 flex-col gap-1.5 p-3">
            {[
              { icon: "◈", label: "New check", hint: "Run a page from the main panel", active: true },
              { icon: "▤", label: "Reports", hint: "Coming later", active: false },
              { icon: "◇", label: "Rules", hint: "Coming later", active: false },
            ].map((item, i) => (
              <div
                key={item.label}
                title={item.hint}
                className={`tl-card-enter rounded-xl px-3 py-2.5 text-left text-sm transition-transform duration-300 hover:translate-x-0.5 ${
                  item.active
                    ? "bg-gradient-to-r from-violet-500/20 to-cyan-500/10 font-medium text-white ring-1 ring-violet-400/35 shadow-[0_0_24px_-8px_rgba(139,92,246,0.5)]"
                    : "text-white/35"
                }`}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className={item.active ? "text-violet-300" : "text-white/25"}>{item.icon}</span> {item.label}
              </div>
            ))}
          </nav>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-3 py-4 text-lg text-white/30" aria-hidden>
            <span title="New check">◈</span>
            <span title="Reports">▤</span>
            <span title="Rules">◇</span>
          </div>
        )}
        {!sidebarCollapsed ? (
          <p className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-white/40">
            One snapshot per URL. Up to {MAX_URLS_PER_RUN} URLs per run, separate reports. Optional AI summary.
          </p>
        ) : null}
        <div className={`mt-auto border-t border-white/10 ${sidebarCollapsed ? "p-2" : "p-3"}`}>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-[11px] font-medium text-white/55 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white/80`}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              "⟩"
            ) : (
              <>
                <span aria-hidden>⟨</span> Hide menu
              </>
            )}
          </button>
        </div>
      </aside>

      <main className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="tl-glass flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/10 px-4 py-4 shadow-sm shadow-black/20 sm:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="mt-0.5 shrink-0 rounded-lg border border-white/15 p-2 text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              aria-label={sidebarCollapsed ? "Show side menu" : "Hide side menu"}
              aria-expanded={!sidebarCollapsed}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="tl-fade-up min-w-0 max-w-2xl" style={{ animationDelay: "40ms" }}>
              <h1 className="bg-gradient-to-r from-white via-violet-200 to-cyan-200 bg-clip-text font-display text-lg font-bold tracking-tight text-transparent sm:text-xl">
                Check your site&apos;s tags and data layer
              </h1>
              <div className="mt-2 h-px w-32 rounded-full bg-gradient-to-r from-violet-500/80 via-fuchsia-500/50 to-cyan-400/80" />
              <p className="mt-2 text-sm text-white/50">
                We open the page once, record tag-related signals, and list problems by priority. Export results or send
                a finding to <span className="text-white/70">Jira</span> if your team tracks bugs there.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all duration-300 ${
                apiOk === null
                  ? "border-white/10 bg-white/5 text-white/45"
                  : apiOk
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_-4px_rgba(52,211,153,0.45)]"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full motion-reduce:animate-none ${apiOk === null ? "bg-white/30" : apiOk ? "animate-pulse bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-400"}`}
              />
              {apiOk === null ? "Starting…" : apiOk ? "App ready" : "App unavailable"}
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden p-5 xl:flex-row xl:items-stretch xl:overflow-hidden">
          <section className="report-scroll flex min-h-0 w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 xl:max-w-[22rem]">
            <div
              className="tl-glass tl-fade-up rounded-2xl border border-white/10 p-5 shadow-xl ring-1 ring-violet-500/10"
              style={{ animationDelay: "0ms" }}
            >
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-300/90">Your scan</h2>
              <details className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-white/50">
                <summary className="cursor-pointer font-medium text-white/65">
                  What we check (Launch / digitalData style)
                </summary>
                <ul className="mt-2 list-disc space-y-1.5 pl-4">
                  <li>
                    <code className="text-cyan-300/80">window.digitalData</code> and a{" "}
                    <code className="text-cyan-300/80">digitalData.page</code> object before tracking
                  </li>
                  <li>
                    <code className="text-cyan-300/80">digitalDataHelper.init</code> when that helper exists
                  </li>
                  <li>
                    <code className="text-cyan-300/80">data-track</code> +{" "}
                    <code className="text-cyan-300/80">data-track-id</code> on sampled clickables
                  </li>
                  <li>
                    <code className="text-violet-300/80">_satellite.track</code>, including{" "}
                    <code className="text-violet-300/80">global-route-view</code> on this load (SPAs need a new run per
                    route)
                  </li>
                  <li>
                    Analytics-style network requests, Adobe Analytics <code className="text-cyan-300/80">/b/ss/</code> hit
                    decoding (eVars/props/events where present), failed tag loads, and storage key names (no values)
                  </li>
                </ul>
              </details>
              <label className="mt-4 block text-xs text-white/45">Page URLs (one per line, up to {MAX_URLS_PER_RUN})</label>
              <textarea
                rows={5}
                className="report-scroll mt-1.5 w-full resize-y overflow-y-auto rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-cyan-500/0 transition focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/25"
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                placeholder={"https://www.example.com\nhttps://www.example.com/page2"}
              />
              <p className="mt-1 text-[11px] text-white/40">
                {parsedUrls.length} valid URL{parsedUrls.length === 1 ? "" : "s"} detected
                {parsedUrls.length >= MAX_URLS_PER_RUN ? ` (max ${MAX_URLS_PER_RUN} per run)` : ""}
                {parsedUrls.length > 0 ? " · locally a browser window opens for login; on server paste auth cookies below" : ""}
              </p>

              <label className="mt-4 block text-xs text-white/45">Extra wait after load (ms)</label>
              <input
                type="number"
                min={0}
                max={30000}
                step={100}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/25"
                value={waitMs}
                onChange={(e) => setWaitMs(Number(e.target.value))}
              />
              <label className="mt-4 block text-xs text-white/45">Page load time limit (ms)</label>
              <input
                type="number"
                min={5000}
                max={90000}
                step={1000}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/25"
                value={navTimeoutMs}
                onChange={(e) => setNavTimeoutMs(Number(e.target.value))}
              />

              <details className="mt-4 rounded-lg border border-white/10 bg-black/25">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-white/65">
                  Auth cookies (for login-protected pages)
                </summary>
                <div className="px-3 pb-3">
                  <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                    Paste cookies from your browser&apos;s DevTools (Application → Cookies). Use
                    {" "}<code className="text-cyan-300/70">name=value; name2=value2</code> format, or JSON
                    from the &quot;Export&quot; option.
                    Cookies are injected into the headless browser so login-protected pages can be audited on the server.
                  </p>
                  <textarea
                    rows={3}
                    className="report-scroll mt-2 w-full resize-y overflow-y-auto rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none ring-cyan-500/0 transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/25"
                    value={cookiesInput}
                    onChange={(e) => setCookiesInput(e.target.value)}
                    placeholder={'session_id=abc123; auth_token=xyz789'}
                  />
                  {cookiesInput.trim() && (
                    <p className="mt-1 text-[11px] text-cyan-300/60">
                      {parseCookiesFromText(cookiesInput).length} cookie{parseCookiesFromText(cookiesInput).length === 1 ? "" : "s"} detected
                    </p>
                  )}
                </div>
              </details>

              <button
                type="button"
                onClick={runAudit}
                disabled={loading || !urlsValid}
                className="tl-shimmer-btn mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 via-violet-500 to-cyan-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition hover:shadow-violet-500/45 hover:brightness-[1.08] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
              >
                <span className="relative z-[1] inline-flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                      {parsedUrls.length > 1 ? `Checking ${parsedUrls.length} pages…` : "Checking page…"}
                    </>
                  ) : parsedUrls.length > 1 ? (
                    `Run check (${parsedUrls.length} URLs)`
                  ) : (
                    "Run check"
                  )}
                </span>
              </button>
              {loginWaiting && loginSessionId && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-block h-4 w-4 animate-pulse rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-amber-100">Browser opened — waiting for you</p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-200/70">
                        A browser window has opened with your URL
                        {loginPageTitle ? (
                          <> (<strong className="text-white/80">{loginPageTitle}</strong>)</>
                        ) : null}
                        . Log in, fill in details, or navigate as needed. When you&apos;re ready, click <strong className="text-white/80">Continue audit</strong> below
                        {loginSessionUrls.length > 1 ? (
                          <> to scan all <strong className="text-white/80">{loginSessionUrls.length} URLs</strong> using this session</>
                        ) : null}
                        .
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => continueAfterLogin()}
                          disabled={loading}
                          className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
                        >
                          {loading ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              {loginSessionUrls.length > 1 ? `Auditing ${loginSessionUrls.length} pages…` : "Capturing audit…"}
                            </span>
                          ) : (
                            loginSessionUrls.length > 1 ? `Continue audit (${loginSessionUrls.length} URLs)` : "Continue audit"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelLogin}
                          disabled={loading}
                          className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.1] disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {error ? (
                <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {error}
                </p>
              ) : null}
            </div>

            <div
              className="tl-glass tl-fade-up rounded-2xl border border-white/10 p-5 ring-1 ring-amber-500/10"
              style={{ animationDelay: "60ms" }}
            >
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/90">
                Adobe Cloud (optional)
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                Server-side calls to{" "}
                <a
                  className="text-cyan-400 underline"
                  href="https://developer.adobe.com/analytics-apis/docs/2.0/guides/reportsuite/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Analytics 2.0
                </a>{" "}
                and{" "}
                <a
                  className="text-cyan-400 underline"
                  href="https://experienceleague.adobe.com/docs/experience-platform/tags/api/endpoints/rules.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Tags (Reactor)
                </a>{" "}
                when you add credentials to server env. Processing rules / Vista / hit acceptance in Adobe’s pipeline are
                not public APIs—see limitations in the JSON from “Status”.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/50">
                <span
                  className={`rounded-full border px-2 py-0.5 ${adobeIntegration?.analytics2?.configured ? "border-emerald-500/40 text-emerald-200/90" : "border-white/15"}`}
                >
                  Analytics API: {adobeIntegration?.analytics2?.configured ? "on" : "off"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 ${adobeIntegration?.tagsReactor?.configured ? "border-emerald-500/40 text-emerald-200/90" : "border-white/15"}`}
                >
                  Tags API: {adobeIntegration?.tagsReactor?.configured ? "on" : "off"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  fetch("/api/adobe/integration")
                    .then((r) => r.json())
                    .then((d) => setAdobeIntegration(d))
                    .catch(() => setAdobeIntegration(null));
                }}
                className="mt-2 text-[11px] font-medium text-cyan-400 underline"
              >
                Refresh connection status
              </button>
              <label className="mt-3 block text-xs text-white/45">Report suite ID (RSID)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/35"
                placeholder={suggestedAdobeRsid || "e.g. mycompanysuite"}
                value={adobeRsid}
                onChange={(e) => setAdobeRsid(e.target.value)}
              />
              {suggestedAdobeRsid ? (
                <button
                  type="button"
                  onClick={() => setAdobeRsid(suggestedAdobeRsid)}
                  className="mt-1 text-[11px] text-cyan-400 underline"
                >
                  Use RSID from last scan ({suggestedAdobeRsid})
                </button>
              ) : null}
              <label className="mt-3 block text-xs text-white/45">Tags property ID override (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none focus:border-amber-500/35"
                placeholder="PR… (else ADOBE_TAGS_PROPERTY_ID env)"
                value={adobePropertyOverride}
                onChange={(e) => setAdobePropertyOverride(e.target.value)}
              />
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={adobePanelBusy}
                  onClick={() =>
                    fetch("/api/adobe/integration")
                      .then((r) => r.json())
                      .then((d) => {
                        setAdobePanelError(null);
                        setAdobePanelJson(JSON.stringify(d, null, 2));
                      })
                      .catch((e) => setAdobePanelError(String(e)))
                  }
                  className="rounded-lg border border-white/15 bg-white/[0.06] py-2 text-xs font-medium text-white/85 hover:bg-white/[0.1] disabled:opacity-40"
                >
                  Status + limitations
                </button>
                <button
                  type="button"
                  disabled={adobePanelBusy || !adobeIntegration?.analytics2?.configured}
                  onClick={fetchAdobeReportSuiteSettings}
                  className="rounded-lg border border-amber-500/25 bg-amber-500/10 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Fetch report suite settings
                </button>
                <button
                  type="button"
                  disabled={adobePanelBusy || !adobeIntegration?.tagsReactor?.configured}
                  onClick={fetchAdobeTagsRules}
                  className="rounded-lg border border-amber-500/25 bg-amber-500/10 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Fetch Launch rules (property)
                </button>
                <button
                  type="button"
                  disabled={adobePanelBusy || !adobeIntegration?.tagsReactor?.configured}
                  onClick={fetchAdobeTagsExtensions}
                  className="rounded-lg border border-amber-500/25 bg-amber-500/10 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Fetch extensions (property)
                </button>
              </div>
              {adobePanelError ? (
                <p className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
                  {adobePanelError}
                </p>
              ) : null}
              {adobePanelJson ? (
                <pre className="report-scroll mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-white/65">
                  {adobePanelJson}
                </pre>
              ) : null}
            </div>

            <div
              className="tl-glass tl-fade-up rounded-2xl border border-white/10 p-5 ring-1 ring-cyan-500/5"
              style={{ animationDelay: "90ms" }}
            >
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/90">AI report (optional)</h2>
              {geminiConfigured === false ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs leading-relaxed text-white/50">
                  <span className="font-medium text-white/80">AI is turned off.</span> Add{" "}
                  <code className="text-cyan-300/80">GEMINI_API_KEY</code> to{" "}
                  <code className="text-violet-300/80">.env.local</code>, restart the app, then{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setGeminiConfigured(null);
                      refreshGeminiConfigured();
                    }}
                    className="font-medium text-cyan-400 underline"
                  >
                    check again
                  </button>
                  .
                </div>
              ) : null}
              <p className="mt-2 text-xs text-white/45">
                Optional plain-language write-up. You can change the instructions below to match how your team writes
                test notes.
              </p>
              <textarea
                className="report-scroll mt-3 h-40 w-full resize-y overflow-y-auto rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs leading-relaxed text-white/85 outline-none focus:border-violet-500/35 focus:ring-1 focus:ring-violet-500/20"
                value={customRules}
                onChange={(e) => setCustomRules(e.target.value)}
              />
              <button
                type="button"
                onClick={runAi}
                disabled={!report || aiLoading || geminiConfigured !== true}
                className="tl-shimmer-btn mt-3 w-full rounded-xl border border-white/15 bg-white/[0.08] py-3 text-sm font-medium text-white transition hover:border-cyan-400/30 hover:bg-white/[0.12] hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.25)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100"
              >
                <span className="relative z-[1] inline-flex items-center justify-center gap-2">
                  {aiLoading ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-cyan-300 motion-reduce:animate-none" />
                      Writing…
                    </>
                  ) : geminiConfigured === false ? (
                    "Add AI key"
                  ) : geminiConfigured === null ? (
                    "Checking…"
                  ) : (
                    "Write AI report"
                  )}
                </span>
              </button>
              {aiError ? (
                <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {aiError}
                </p>
              ) : null}
            </div>
          </section>

          <section className="tl-glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)] ring-1 ring-violet-500/10">
            {!batchResults ? (
              <div className="report-scroll flex flex-1 flex-col items-center justify-center overflow-y-auto p-8 text-center">
                <EmptyStateHero />
              </div>
            ) : !report ? (
              <div className="report-scroll flex flex-1 flex-col gap-4 overflow-y-auto p-6">
                {batchResults.length > 1 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <label className="block text-[11px] font-medium text-white/50">Show result for</label>
                    <select
                      className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/40"
                      value={selectedBatchIndex}
                      onChange={(e) => setSelectedBatchIndex(Number(e.target.value))}
                    >
                      {batchResults.map((r, i) => (
                        <option key={`${r.url}-${i}`} value={i}>
                          {r.ok ? `${r.url} · score ${r.report?.score ?? "—"}` : `${r.url} · failed`}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-5 py-6 text-sm text-rose-100">
                  <p className="font-medium text-white">No report for this URL</p>
                  <p className="mt-2 text-white/70">
                    {batchResults[selectedBatchIndex]?.error || "Unknown error."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {batchResults.length > 1 ? (
                  <div className="flex shrink-0 flex-col gap-2 border-b border-white/10 bg-black/20 px-5 py-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <label className="text-[11px] font-medium text-white/50">Report for</label>
                      <select
                        className="mt-1 w-full max-w-xl rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/40"
                        value={selectedBatchIndex}
                        onChange={(e) => {
                          setSelectedBatchIndex(Number(e.target.value));
                          setTab("issues");
                        }}
                      >
                        {batchResults.map((r, i) => (
                          <option key={`${r.url}-${i}`} value={i}>
                            {r.ok ? `${r.url} · ${r.report?.score ?? "—"}/100` : `${r.url} · failed`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-white/45">
                      {batchResults.filter((r) => r.ok).length} ok · {batchResults.filter((r) => !r.ok).length} failed ·{" "}
                      {batchResults.length} total
                    </p>
                  </div>
                ) : null}
                <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
                  <div className="flex flex-wrap items-center gap-5">
                    <ScoreRing score={report.score} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Scanned page</p>
                      <p className="mt-1 max-w-xl truncate font-medium text-white">{report.snapshot.title}</p>
                      <a
                        href={report.snapshot.finalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-sm text-cyan-400 hover:underline"
                      >
                        {report.snapshot.finalUrl}
                      </a>
                      <p className="mt-2 text-xs text-white/40">
                        {new Date(report.snapshot.fetchedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex max-w-full flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={exportIssuesCsv}
                      className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-200 transition hover:border-rose-400/50 hover:shadow-[0_0_16px_-4px_rgba(251,113,133,0.35)] hover:brightness-110 active:scale-[0.97]"
                    >
                      Issues · CSV
                    </button>
                    <button
                      type="button"
                      onClick={exportIssuesMd}
                      className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-200 transition hover:border-amber-400/45 hover:shadow-[0_0_16px_-4px_rgba(251,191,36,0.3)] hover:brightness-110 active:scale-[0.97]"
                    >
                      Issues · Markdown
                    </button>
                    <button
                      type="button"
                      onClick={exportDetailedHtml}
                      className="rounded-xl border border-violet-500/35 bg-violet-500/15 px-3 py-2 text-[11px] font-semibold text-violet-200 transition hover:border-violet-400/55 hover:shadow-[0_0_20px_-4px_rgba(167,139,250,0.4)] hover:brightness-110 active:scale-[0.97]"
                    >
                      Report · HTML
                    </button>
                    <button
                      type="button"
                      onClick={exportJson}
                      className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/[0.1] active:scale-[0.97]"
                    >
                      All data · JSON
                    </button>
                    {aiMarkdown ? (
                      <button
                        type="button"
                        onClick={exportMarkdown}
                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-200 transition hover:border-cyan-400/50 hover:shadow-[0_0_18px_-4px_rgba(34,211,238,0.35)] active:scale-[0.97]"
                      >
                        AI · Markdown
                      </button>
                    ) : null}
                  </div>
                </div>

                <TabStrip tabs={[...tabDefs]} active={tab} onChange={setTab} />

                <div className="report-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
                  {tab === "issues" && (
                    <IssuesQueuePanel
                      report={report}
                      jiraConfigured={jiraConfigured}
                      onRefreshJira={refreshJiraConfigured}
                    />
                  )}
                  {tab === "events" && hasEventStream && (
                    <EventStreamTab report={report} />
                  )}
                  {tab === "checks" && (
                    <ul className="space-y-3">
                      {report.checks.map((c, idx) => (
                        <li
                          key={`${c.id}-${idx}`}
                          className="tl-card-enter flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition duration-300 hover:border-white/18 hover:bg-white/[0.07]"
                          style={{ animationDelay: `${Math.min(idx, 14) * 40}ms` }}
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
                  )}
                  {tab === "detailed" && <VerificationReport report={report} />}
                  {tab === "raw" && (
                    <pre className="report-scroll max-h-[min(70vh,560px)] overflow-auto rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs leading-relaxed text-white/55">
                      {JSON.stringify(report.snapshot, null, 2)}
                    </pre>
                  )}
                  {tab === "ai" && (
                    <div className="rounded-xl border border-white/10 bg-black/35 p-6">
                      {aiMarkdown ? (
                        <div className="report-scroll max-h-[min(70vh,600px)] overflow-y-auto pr-2">
                          <ReportMarkdown content={aiMarkdown} />
                        </div>
                      ) : geminiConfigured === false ? (
                        <p className="text-sm text-white/50">
                          Turn on AI in <code className="text-cyan-300">.env.local</code>, or stay on the{" "}
                          <strong className="text-white/80">Issues</strong> tab—no AI needed.
                        </p>
                      ) : (
                        <p className="text-sm text-white/50">
                          Choose <strong className="text-white/80">Write AI report</strong> in the left column after a
                          check finishes.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
