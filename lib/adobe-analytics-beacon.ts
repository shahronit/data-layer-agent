/**
 * Client-side Adobe Analytics collection URL detection and query/body parsing.
 * Mirrors what analysts see in Network / Experience Platform Debugger for /b/ss/ style hits.
 * Does not call Adobe Admin APIs (processing rules, Vista, RS config are server-side).
 */

import type { AdobeAnalyticsHitSample, AdobeAnalyticsParamRow } from "./types";

export const MAX_ADOBE_ANALYTICS_HITS = 14;

/** AppMeasurement / Launch image & POST beacons; AEP Edge domains (JSON body may apply). */
export function isAdobeAnalyticsCollectionUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (/\/b\/ss\//.test(u)) return true;
  if (u.includes(".2o7.net") && u.includes("/b/ss/")) return true;
  if (u.includes("omtrdc.net") && /\/b\/ss\//.test(u)) return true;
  if (u.includes("smetrics.") && /\/b\/ss\//.test(u)) return true;
  if (u.includes("adobedc.net") && (u.includes("/ee/") || u.includes("interact") || u.includes("collect")))
    return true;
  if (u.includes("analytics.adobe.io")) return true;
  return false;
}

/** Report suite id(s) from path: /b/ss/RSID1,RSID2/... */
export function extractReportSuitesFromAdobePath(url: string): string[] | undefined {
  try {
    const m = url.match(/\/b\/ss\/([^/?]+)/i);
    if (!m?.[1]) return undefined;
    const raw = decodeURIComponent(m[1]);
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : undefined;
  } catch {
    return undefined;
  }
}

const ADOBE_PARAM_HINTS: Record<string, string> = {
  pagename: "Page name",
  page: "Page (legacy)",
  g: "Current URL",
  r: "Referrer",
  s: "Screen resolution / monitor (context)",
  t: "Timestamp / hit type context",
  c: "Color depth / context",
  cc: "Cookie support",
  ch: "Channel",
  server: "Server",
  events: "Events",
  products: "Products",
  pe: "Link type (download/exit/custom)",
  pev2: "Link name / detail",
  pev1: "Legacy link detail",
  vh: "Viewport height",
  vw: "Viewport width",
  pid: "Page identifier",
  pageurl: "Page URL",
  page_type: "Page type",
  campaign: "Campaign / tracking code",
  state: "State",
  zip: "ZIP",
  purchaseid: "Purchase ID",
  transactionid: "Transaction ID",
  hier1: "Hierarchy 1",
  hier2: "Hierarchy 2",
  hier3: "Hierarchy 3",
  hier4: "Hierarchy 4",
  hier5: "Hierarchy 5",
  list1: "List prop 1",
  list2: "List prop 2",
  list3: "List prop 3",
  timestamp: "Timestamp",
  ev: "Event (var)",
  v0: "Variable slot (legacy)",
};

function hintForKey(key: string): string | undefined {
  const k = key.toLowerCase();
  if (ADOBE_PARAM_HINTS[k]) return ADOBE_PARAM_HINTS[k];
  if (/^evar\d+$/i.test(k)) return `eVar ${k.replace(/^evar/i, "")}`;
  if (/^prop\d+$/i.test(k)) return `prop ${k.replace(/^prop/i, "")}`;
  if (/^hier\d+$/i.test(k)) return `hierarchy ${k.replace(/^hier/i, "")}`;
  if (/^list\d+$/i.test(k)) return `list prop ${k.replace(/^list/i, "")}`;
  return undefined;
}

function mergeUrlAndBodyParams(
  url: string,
  method: string,
  postData: string | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (params: URLSearchParams) => {
    params.forEach((value, key) => {
      out[key] = value;
    });
  };
  try {
    put(new URL(url).searchParams);
  } catch {
    /* ignore */
  }
  if (!postData || method.toUpperCase() !== "POST") return out;
  const trimmed = postData.trim();
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as unknown;
      if (j && typeof j === "object" && !Array.isArray(j)) {
        for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
          if (v === null || v === undefined) continue;
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            out[k] = String(v);
          }
        }
      }
    } catch {
      /* ignore */
    }
    return out;
  }
  try {
    put(new URLSearchParams(trimmed));
  } catch {
    /* ignore */
  }
  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

const MAX_PARAMS_PER_HIT = 90;
const MAX_VALUE_LEN = 360;
const MAX_URL_SHORT = 280;

export function buildAdobeAnalyticsHitSample(
  fullUrl: string,
  method: string,
  status: number,
  postData: string | null,
): AdobeAnalyticsHitSample {
  const paramsRaw = mergeUrlAndBodyParams(fullUrl, method, postData);
  const keys = Object.keys(paramsRaw).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const reportSuites = extractReportSuitesFromAdobePath(fullUrl);
  const params: AdobeAnalyticsParamRow[] = [];
  for (const key of keys.slice(0, MAX_PARAMS_PER_HIT)) {
    params.push({
      key,
      value: truncate(paramsRaw[key] ?? "", MAX_VALUE_LEN),
      label: hintForKey(key),
    });
  }
  return {
    urlShort: truncate(fullUrl, MAX_URL_SHORT),
    method,
    status,
    reportSuites,
    params,
    paramCount: keys.length,
    truncatedParams: keys.length > MAX_PARAMS_PER_HIT,
  };
}
