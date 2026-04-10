/** Heuristic: URLs that often correspond to analytics / tag beacons (debugger-style visibility). */

import {
  buildAdobeAnalyticsHitSample,
  isAdobeAnalyticsCollectionUrl,
  MAX_ADOBE_ANALYTICS_HITS,
} from "./adobe-analytics-beacon";
import type { AdobeAnalyticsHitSample, FailedRequestSample, NetworkRequestSample } from "./types";

const MAX_LOGGED_REQUESTS = 100;
const MAX_FAILED_LOG = 40;

export function isAnalyticsBeaconUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    /\/b\/ss\//.test(u) ||
    u.includes("google-analytics.com") ||
    u.includes("analytics.google.com") ||
    u.includes("googletagmanager.com") ||
    u.includes("demdex.net") ||
    u.includes("omtrdc.net") ||
    u.includes("doubleclick.net") ||
    u.includes("facebook.com/tr") ||
    u.includes("linkedin.com/px") ||
    u.includes("ads-twitter.com") ||
    u.includes("segment.io") ||
    u.includes("segment.com") ||
    u.includes("cdn.amplitude.com") ||
    u.includes("hotjar.com") ||
    u.includes("clarity.ms") ||
    u.includes("matomo") ||
    u.includes("mixpanel.com") ||
    u.includes("plausible.io") ||
    (u.includes("collect") && (u.includes("adobe") || u.includes("analytics")))
  );
}

function truncateUrl(url: string, max = 220): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max)}…`;
}

export function createNetworkCaptureHandlers(): {
  entries: NetworkRequestSample[];
  failures: FailedRequestSample[];
  adobeAnalyticsHits: AdobeAnalyticsHitSample[];
  attach: (page: import("playwright").Page) => void;
} {
  const entries: NetworkRequestSample[] = [];
  const failures: FailedRequestSample[] = [];
  const adobeAnalyticsHits: AdobeAnalyticsHitSample[] = [];

  function attach(page: import("playwright").Page) {
    page.on("requestfinished", async (request) => {
      try {
        const url = request.url();
        const rt = request.resourceType();
        const response = await request.response().catch(() => null);
        const status = response?.status() ?? 0;

        if (
          isAdobeAnalyticsCollectionUrl(url) &&
          adobeAnalyticsHits.length < MAX_ADOBE_ANALYTICS_HITS
        ) {
          const postData = request.postData();
          adobeAnalyticsHits.push(
            buildAdobeAnalyticsHitSample(url, request.method(), status, postData),
          );
        }

        if (entries.length >= MAX_LOGGED_REQUESTS) return;
        const interesting =
          isAnalyticsBeaconUrl(url) ||
          status >= 400 ||
          ((rt === "xhr" || rt === "fetch") && isAnalyticsBeaconUrl(url));
        if (!interesting) return;
        entries.push({
          url: truncateUrl(url),
          method: request.method(),
          resourceType: rt,
          status,
        });
      } catch {
        /* ignore */
      }
    });

    page.on("requestfailed", (request) => {
      if (failures.length >= MAX_FAILED_LOG) return;
      const url = request.url();
      const rt = request.resourceType();
      if (rt !== "script" && rt !== "stylesheet" && rt !== "xhr" && rt !== "fetch") return;
      const err = request.failure()?.errorText ?? "failed";
      failures.push({ url: truncateUrl(url), error: err });
    });
  }

  return { entries, failures, adobeAnalyticsHits, attach };
}
