import { readAdobeIntegrationEnv } from "./adobe-integration-env";

const REACTOR = "https://reactor.adobe.io";
const ACCEPT = "application/vnd.api+json;revision=1";

function reactorHeaders(): HeadersInit {
  const e = readAdobeIntegrationEnv();
  if (!e.accessToken || !e.apiKey || !e.imsOrgId) {
    throw new Error("Reactor API env incomplete");
  }
  return {
    Accept: ACCEPT,
    "Content-Type": ACCEPT,
    Authorization: `Bearer ${e.accessToken}`,
    "x-api-key": e.apiKey,
    "x-gw-ims-org-id": e.imsOrgId,
  };
}

/** @see https://experienceleague.adobe.com/docs/experience-platform/tags/api/endpoints/rules.html */
export async function fetchPropertyRules(propertyId: string): Promise<{
  ok: true;
  rules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    published: boolean;
    review_status?: string;
  }>;
  raw?: unknown;
} | { ok: false; status: number; message: string }> {
  const e = readAdobeIntegrationEnv();
  if (!e.accessToken || !e.apiKey || !e.imsOrgId) {
    return { ok: false, status: 503, message: "Tags / Reactor API env not configured (token, API key, IMS org)" };
  }
  const url = `${REACTOR}/properties/${encodeURIComponent(propertyId)}/rules`;
  try {
    const res = await fetch(url, { headers: reactorHeaders() });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, message: text.slice(0, 800) || res.statusText };
    }
    const json = JSON.parse(text) as {
      data?: Array<{
        id?: string;
        attributes?: {
          name?: string;
          enabled?: boolean;
          published?: boolean;
          review_status?: string;
        };
      }>;
    };
    const rules =
      json.data?.map((d) => ({
        id: d.id ?? "",
        name: d.attributes?.name ?? "(unnamed)",
        enabled: Boolean(d.attributes?.enabled),
        published: Boolean(d.attributes?.published),
        review_status: d.attributes?.review_status,
      })) ?? [];
    return { ok: true, rules, raw: json };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 502, message };
  }
}

/** @see https://experienceleague.adobe.com/docs/experience-platform/tags/api/endpoints/extensions.html */
export async function fetchPropertyExtensions(propertyId: string): Promise<{
  ok: true;
  extensions: Array<{ id: string; name: string; enabled: boolean }>;
} | { ok: false; status: number; message: string }> {
  const e = readAdobeIntegrationEnv();
  if (!e.accessToken || !e.apiKey || !e.imsOrgId) {
    return { ok: false, status: 503, message: "Tags / Reactor API env not configured" };
  }
  const url = `${REACTOR}/properties/${encodeURIComponent(propertyId)}/extensions`;
  try {
    const res = await fetch(url, { headers: reactorHeaders() });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, message: text.slice(0, 800) || res.statusText };
    }
    const json = JSON.parse(text) as {
      data?: Array<{
        id?: string;
        attributes?: { name?: string; enabled?: boolean };
      }>;
    };
    const extensions =
      json.data?.map((d) => ({
        id: d.id ?? "",
        name: d.attributes?.name ?? "(extension)",
        enabled: Boolean(d.attributes?.enabled),
      })) ?? [];
    return { ok: true, extensions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 502, message };
  }
}
