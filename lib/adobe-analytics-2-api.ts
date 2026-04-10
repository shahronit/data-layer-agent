import { readAdobeIntegrationEnv } from "./adobe-integration-env";

const BASE = "https://analytics.adobe.io";

/** @see https://developer.adobe.com/analytics-apis/docs/2.0/guides/reportsuite/ */
export async function fetchReportSuiteSettings(rsid: string): Promise<{
  ok: true;
  data: unknown;
} | {
  ok: false;
  status: number;
  message: string;
}> {
  const e = readAdobeIntegrationEnv();
  if (!e.accessToken || !e.apiKey || !e.analyticsGlobalCompanyId) {
    return { ok: false, status: 503, message: "Adobe Analytics API env not configured" };
  }
  const url = `${BASE}/api/${encodeURIComponent(e.analyticsGlobalCompanyId)}/reportsuites/${encodeURIComponent(rsid)}/settings`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${e.accessToken}`,
      "x-api-key": e.apiKey,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: text.slice(0, 800) || res.statusText,
    };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: true, data: text };
  }
}

export async function fetchReportSuiteMetadata(rsid: string): Promise<{
  ok: true;
  data: unknown;
} | {
  ok: false;
  status: number;
  message: string;
}> {
  const e = readAdobeIntegrationEnv();
  if (!e.accessToken || !e.apiKey || !e.analyticsGlobalCompanyId) {
    return { ok: false, status: 503, message: "Adobe Analytics API env not configured" };
  }
  const url = `${BASE}/api/${encodeURIComponent(e.analyticsGlobalCompanyId)}/reportsuites/${encodeURIComponent(rsid)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${e.accessToken}`,
      "x-api-key": e.apiKey,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, message: text.slice(0, 800) || res.statusText };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: true, data: text };
  }
}
