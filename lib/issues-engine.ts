import type { AuditReport, CheckResult } from "./types";

export type IssueSeverity = "critical" | "high" | "medium" | "low" | "informational";

/** P1 = address immediately … P4 = monitor */
export type IssuePriority = 1 | 2 | 3 | 4;

export interface PrioritizedIssue {
  priority: IssuePriority;
  severity: IssueSeverity;
  ruleId: string;
  title: string;
  detail: string;
  remediation: string;
  checkStatus: CheckResult["status"];
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

function remediationForRule(id: string, status: CheckResult["status"]): string {
  if (status === "pass") {
    return "No action required for this rule on this snapshot.";
  }
  const map: Record<string, string> = {
    "page-load":
      "Fix navigation or server errors first. Retry the audit with a longer navigation timeout if the page is slow.",
    "gtm-datalayer":
      "Confirm the tag container loads, consent gates allow tags, and increase post-load wait for SPAs. Verify `window.dataLayer` in the browser console after the page settles.",
    "adobe-digitaldata":
      "Create `window.digitalData` before any tracking fires. If you use a helper, call `digitalDataHelper.init()` when available, then set `digitalData.page` for the current view.",
    "digital-data-page":
      "Populate `digitalData.page` (object) with your standard page fields before `_satellite.track` or other beacon logic runs.",
    "digital-data-helper":
      "Expose `window.digitalDataHelper.init` (or load the script that defines it) so the digital layer can be refreshed consistently before events.",
    "launch-route-view":
      "After digitalData is ready, call `window._satellite.track(\"global-route-view\")` on full page loads and on every SPA route change. Re-run this tool after navigation or increase the post-load wait.",
    satellite:
      "Ensure the Launch library loads before your audit window ends; increase wait time or trigger navigation, then verify `_satellite.track` in the browser console.",
    "gtm-containers":
      "If you expect GTM, confirm the snippet is present (inline or loaded script). IDs may not appear when the container is injected from a bundle.",
    "data-track":
      "On buttons, links, filters, and other click targets add both `data-track` and `data-track-id` unless the page spec marks an exception. Retest after dynamic content renders.",
    "page-exceptions":
      "Resolve JavaScript exceptions that may block tag execution; reproduce in devtools Sources and fix the failing script.",
    "console-errors":
      "Open the browser console, identify failing resources or scripts, and fix CORS, 404, or runtime errors affecting the page.",
    "network-errors":
      "Open the Network tab: fix 4xx/5xx on tag scripts or beacon URLs, CORS blocks, and blocked third-party requests so tags can load and send data.",
    "network-beacons":
      "Compare captured beacon URLs and status codes with your tag spec; use the browser Network panel if filters missed first-party or delayed calls.",
    "adobe-analytics-collection":
      "Confirm AppMeasurement / Launch fires after digitalData and consent; increase post-load wait; check for first-party tracking domains. Use Experience Platform Debugger to compare live hits.",
    "adobe-analytics-variables":
      "Open the hit in browser Network (or Adobe’s debugger) and verify eVars, props, and events match your solution design. Web SDK / Edge payloads may be JSON—expand the request payload manually.",
  };
  return map[id] ?? "Review this finding against your tagging specification and validate in a live browser session.";
}

function classifyCheck(c: CheckResult): Omit<PrioritizedIssue, "remediation"> | null {
  if (c.status === "pass") return null;

  let severity: IssueSeverity;
  let priority: IssuePriority;

  if (c.status === "fail") {
    severity = "critical";
    priority = 1;
  } else if (c.status === "warn") {
    if (
      c.id === "page-exceptions" ||
      c.id === "console-errors" ||
      c.id === "launch-route-view" ||
      c.id === "network-errors"
    ) {
      severity = "high";
      priority = 2;
    } else if (
      c.id === "gtm-datalayer" ||
      c.id === "data-track" ||
      c.id === "digital-data-helper" ||
      c.id === "digital-data-page" ||
      c.id === "adobe-analytics-variables" ||
      c.id === "adobe-analytics-collection"
    ) {
      severity = "medium";
      priority = 3;
    } else {
      severity = "medium";
      priority = 3;
    }
  } else {
    severity = "informational";
    priority = 4;
  }

  return {
    priority,
    severity,
    ruleId: c.id,
    title: c.name,
    detail: c.detail,
    checkStatus: c.status,
  };
}

/** Issues to address, sorted P1→P4 then by severity. Passing checks are excluded. */
export function buildPrioritizedIssues(report: AuditReport): PrioritizedIssue[] {
  const raw = report.checks
    .map((c) => {
      const base = classifyCheck(c);
      if (!base) return null;
      return {
        ...base,
        remediation: remediationForRule(c.id, c.status),
      } satisfies PrioritizedIssue;
    })
    .filter((x): x is PrioritizedIssue => x !== null);

  raw.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  return raw;
}

function escMdCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

export function issuesToMarkdown(issues: PrioritizedIssue[], report: AuditReport): string {
  const lines = [
    `# Issues & remediation queue`,
    ``,
    `**Page:** ${report.snapshot.title}`,
    `**URL:** ${report.snapshot.finalUrl}`,
    `**Captured:** ${new Date(report.snapshot.fetchedAt).toISOString()}`,
    `**Health score:** ${report.score}/100`,
    ``,
    `| P | Severity | Rule | Remediation |`,
    `|---|----------|------|-------------|`,
  ];
  for (const i of issues) {
    lines.push(
      `| P${i.priority} | ${i.severity} | ${escMdCell(`${i.ruleId}: ${i.title}`)} | ${escMdCell(i.remediation)} |`,
    );
  }
  lines.push(``, `## Detail`, ``);
  for (const i of issues) {
    lines.push(`### P${i.priority} — ${i.title} (${i.severity})`, ``, i.detail, ``, `**Action:** ${i.remediation}`, ``);
  }
  return lines.join("\n");
}

export function issuesToCsv(issues: PrioritizedIssue[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = ["Priority", "Severity", "Rule ID", "Title", "Detail", "Remediation"];
  const rows = issues.map((i) =>
    [
      `P${i.priority}`,
      i.severity,
      i.ruleId,
      i.title,
      i.detail,
      i.remediation,
    ].map(esc),
  );
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
