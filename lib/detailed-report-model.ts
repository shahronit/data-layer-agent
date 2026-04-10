import { REPORT_PRODUCT_NAME } from "./brand";
import type { AuditReport, AuditSnapshot, CheckResult } from "./types";

export interface DetailedCheckRow {
  id: string;
  name: string;
  status: CheckResult["status"];
  detail: string;
}

export interface DataLayerRow {
  index: number;
  json: string;
}

export interface TrackedRow {
  tag: string;
  dataTrack?: string;
  dataTrackId?: string;
  dataTrackRemoval?: string;
  dataProductId?: string;
  textSnippet: string;
}

export interface DetailedReportModel {
  toolName: string;
  generatedAtIso: string;
  generatedAtDisplay: string;
  page: {
    requestedUrl: string;
    resolvedUrl: string;
    title: string;
    capturedAtDisplay: string;
    loadMs: number;
    pageError?: string;
  };
  summary: {
    score: number;
    passCount: number;
    warnCount: number;
    failCount: number;
    infoCount: number;
    totalChecks: number;
    executiveParagraph: string;
    recommendations: string[];
  };
  checks: DetailedCheckRow[];
  snapshot: {
    adobeSatellitePresent: boolean;
    gtmContainerIds: string[];
    dataLayerPresent: boolean;
    dataLayerLength: number;
    dataLayerRows: DataLayerRow[];
    digitalDataPresent: boolean;
    digitalDataJson: string;
    trackedElements: TrackedRow[];
    consoleErrors: string[];
    pageErrors: string[];
  };
}

function safeJson(value: unknown, space = 2): string {
  try {
    return JSON.stringify(value, null, space);
  } catch {
    return String(value);
  }
}

function buildRecommendations(
  checks: CheckResult[],
  snapshot: AuditSnapshot,
): string[] {
  const out: string[] = [];
  for (const c of checks) {
    if (c.status === "fail") {
      out.push(`${c.name}: ${c.detail}`);
    }
  }
  if (!snapshot.dataLayer?.length) {
    out.push(
      "No `window.dataLayer` events were captured at snapshot time. If you use GTM, confirm the container fires after load or increase the post-load wait; verify in the browser Network tab that `gtm.js` loads.",
    );
  }
  if (!snapshot.digitalData || Object.keys(snapshot.digitalData).length === 0) {
    out.push(
      "No `window.digitalData` object was present. If your stack uses it, initialize the object before tag rules run.",
    );
  }
  if (!snapshot.adobeSatellitePresent) {
    out.push(
      "`window._satellite` was not detected at capture time—the tag runtime may load asynchronously; retry with a longer wait or after navigation.",
    );
  }
  if (snapshot.consoleErrors.length > 0) {
    out.push(
      `Review ${snapshot.consoleErrors.length} console error(s); JavaScript errors can block tag execution or data layer updates.`,
    );
  }
  if ((snapshot.pageErrors?.length ?? 0) > 0) {
    out.push("Uncaught page exceptions were observed; fix script errors that may interrupt analytics.");
  }
  if (out.length === 0) {
    out.push(
      "No critical gaps flagged on this snapshot. Continue validating hits with your tag debugger or network panel and your solution design.",
    );
  }
  return out;
}

export function buildDetailedReportModel(report: AuditReport): DetailedReportModel {
  const { snapshot, checks, score } = report;
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const infoCount = checks.filter((c) => c.status === "info").length;

  const dataLayer = snapshot.dataLayer ?? [];
  const dataLayerRows: DataLayerRow[] = dataLayer.map((entry, index) => ({
    index,
    json: safeJson(entry),
  }));

  const digitalDataJson = snapshot.digitalData
    ? safeJson(snapshot.digitalData)
    : "null";

  let executiveParagraph = `This report shows client-side tagging and data-layer signals at one moment in time (like a single browser check during QA). `;
  executiveParagraph += `The page "${snapshot.title || "(no title)"}" was requested as ${snapshot.url} and resolved to ${snapshot.finalUrl}. `;
  executiveParagraph += `Capture completed in ${snapshot.loadMs} ms after navigation and configured post-load wait. `;
  executiveParagraph += `Automated health score: ${score}/100, based on ${checks.length} rules (${passCount} pass, ${warnCount} warn, ${failCount} fail, ${infoCount} informational). `;
  if (snapshot.pageError) {
    executiveParagraph += `Page load reported an error: ${snapshot.pageError}. `;
  }
  executiveParagraph += `Use the sections below to compare against your tagging specification (data layer shape, container events, DOM attributes).`;

  return {
    toolName: REPORT_PRODUCT_NAME,
    generatedAtIso: new Date().toISOString(),
    generatedAtDisplay: new Date().toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "medium",
    }),
    page: {
      requestedUrl: snapshot.url,
      resolvedUrl: snapshot.finalUrl,
      title: snapshot.title || "—",
      capturedAtDisplay: new Date(snapshot.fetchedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      }),
      loadMs: snapshot.loadMs,
      pageError: snapshot.pageError,
    },
    summary: {
      score,
      passCount,
      warnCount,
      failCount,
      infoCount,
      totalChecks: checks.length,
      executiveParagraph,
      recommendations: buildRecommendations(checks, snapshot),
    },
    checks: checks.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      detail: c.detail,
    })),
    snapshot: {
      adobeSatellitePresent: snapshot.adobeSatellitePresent,
      gtmContainerIds: snapshot.gtmContainerIds,
      dataLayerPresent: dataLayer.length > 0,
      dataLayerLength: dataLayer.length,
      dataLayerRows,
      digitalDataPresent: Boolean(snapshot.digitalData && Object.keys(snapshot.digitalData).length > 0),
      digitalDataJson,
      trackedElements: snapshot.trackedElements.map((t) => ({
        tag: t.tag,
        dataTrack: t.dataTrack,
        dataTrackId: t.dataTrackId,
        dataTrackRemoval: t.dataTrackRemoval,
        dataProductId: t.dataProductId,
        textSnippet: t.textSnippet,
      })),
      consoleErrors: [...snapshot.consoleErrors],
      pageErrors: [...(snapshot.pageErrors ?? [])],
    },
  };
}
