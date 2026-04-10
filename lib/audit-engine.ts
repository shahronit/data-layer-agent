import type { Page } from "playwright";
import { getSharedBrowser } from "@/lib/browser-launch";
import { createNetworkCaptureHandlers } from "@/lib/network-capture";
import type { AuditSnapshot, InteractiveGapSample, TrackedElementSample } from "./types";

const DEFAULT_TIMEOUT_MS = 45_000;
const DATALAYER_WAIT_CAP_MS = 4_000;

async function waitForDataLayerOrTimeout(page: Page, capMs: number): Promise<void> {
  try {
    await page.waitForFunction(
      () => Array.isArray((window as Window & { dataLayer?: unknown[] }).dataLayer),
      { timeout: capMs },
    );
  } catch {
    /* pages without GTM never satisfy this */
  }
}

/** Wait for at least one common tag signal so we can shorten blind sleep. */
async function waitForTagReadiness(page: Page, capMs: number): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const w = window as Window & {
          dataLayer?: unknown[];
          digitalData?: unknown;
          _satellite?: unknown;
        };
        return (
          (Array.isArray(w.dataLayer) && w.dataLayer.length > 0) ||
          (w.digitalData !== undefined &&
            w.digitalData !== null &&
            typeof w.digitalData === "object") ||
          (typeof w._satellite === "object" && w._satellite !== null)
        );
      },
      { timeout: capMs },
    );
  } catch {
    /* timed out — continue with remainder wait */
  }
}

/** Observe Launch-style _satellite.track(name) calls during the page session. */
async function installSatelliteTrackHook(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as Window & {
      __llTrackEvents?: string[];
      __llSatTrackPatched?: boolean;
    };
    w.__llTrackEvents = [];
    const patch = () => {
      try {
        const sat = (
          window as unknown as {
            _satellite?: { track?: (n: unknown, ...a: unknown[]) => unknown };
          }
        )._satellite;
        if (!sat || typeof sat.track !== "function" || w.__llSatTrackPatched) return;
        w.__llSatTrackPatched = true;
        const orig = sat.track.bind(sat);
        sat.track = (name: unknown, ...rest: unknown[]) => {
          try {
            const arr = w.__llTrackEvents!;
            if (arr.length < 100) arr.push(String(name));
          } catch {
            /* ignore */
          }
          return orig(name, ...rest);
        };
      } catch {
        /* ignore */
      }
    };
    const iv = window.setInterval(patch, 40);
    window.setTimeout(() => window.clearInterval(iv), 90_000);
  });
}

export async function capturePageAudit(
  url: string,
  options: { waitAfterLoadMs?: number; timeoutMs?: number } = {},
): Promise<AuditSnapshot> {
  const waitAfterLoadMs = options.waitAfterLoadMs ?? 2500;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchedAt = new Date().toISOString();
  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LayerLens/1.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  const net = createNetworkCaptureHandlers();
  net.attach(page);

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const started = Date.now();
  let finalUrl = url;
  let title = "";
  let pageError: string | undefined;

  await installSatelliteTrackHook(page);

  try {
    await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
    finalUrl = page.url();
    title = await page.title();
    await waitForDataLayerOrTimeout(page, DATALAYER_WAIT_CAP_MS);
    const readinessBudget = Math.min(5000, Math.max(1200, Math.floor(waitAfterLoadMs * 0.5)));
    await waitForTagReadiness(page, readinessBudget);
    const remainder = Math.max(700, waitAfterLoadMs - readinessBudget);
    await new Promise((r) => setTimeout(r, remainder));
  } catch (e) {
    pageError = e instanceof Error ? e.message : String(e);
  }

  const loadMs = Date.now() - started;

  let dataLayer: unknown[] | null = null;
  let digitalData: Record<string, unknown> | null = null;
  let adobeSatellitePresent = false;
  let gtmContainerIds: string[] = [];
  let trackedElements: TrackedElementSample[] = [];
  let digitalDataPagePresent = false;
  let digitalDataHelperInitPresent = false;
  let satelliteTrackEventsObserved: string[] = [];
  let interactiveSampledCount = 0;
  let interactiveMissingBothAttrsCount = 0;
  let interactiveMissingDataTrackIdCount = 0;
  let interactiveMissingDataTrackOnlyCount = 0;
  let interactiveGapSamples: InteractiveGapSample[] = [];
  let storageKeysSample: { localStorage: string[]; sessionStorage: string[] } = {
    localStorage: [],
    sessionStorage: [],
  };

  if (!pageError) {
    try {
      const extracted = await page.evaluate(() => {
        const w = window as Window & {
          dataLayer?: unknown[];
          digitalData?: Record<string, unknown>;
          _satellite?: unknown;
          digitalDataHelper?: { init?: unknown };
          __llTrackEvents?: string[];
        };

        const lsKeys: string[] = [];
        const ssKeys: string[] = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && lsKeys.length < 48) lsKeys.push(k);
          }
        } catch {
          /* storage may be inaccessible */
        }
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && ssKeys.length < 48) ssKeys.push(k);
          }
        } catch {
          /* ignore */
        }

        const dl = Array.isArray(w.dataLayer) ? [...w.dataLayer] : null;
        let dd: Record<string, unknown> | null = null;
        if (w.digitalData && typeof w.digitalData === "object") {
          try {
            dd = JSON.parse(JSON.stringify(w.digitalData)) as Record<string, unknown>;
          } catch {
            dd = { _note: "digitalData present but not JSON-serializable" };
          }
        }

        let digitalDataPagePresentInner = false;
        if (w.digitalData && typeof w.digitalData === "object") {
          const p = w.digitalData.page;
          digitalDataPagePresentInner =
            p !== null && p !== undefined && typeof p === "object" && !Array.isArray(p);
        }

        const helper = w.digitalDataHelper;
        const digitalDataHelperInitPresentInner = typeof helper?.init === "function";

        const trackEv = Array.isArray(w.__llTrackEvents) ? [...w.__llTrackEvents] : [];

        const scripts = Array.from(document.querySelectorAll("script")).map((s) => s.textContent || "");
        const joined = scripts.join("\n");
        const gtmMatches = joined.match(/GTM-[A-Z0-9]+/g) || [];
        const gtmIds = [...new Set(gtmMatches)];

        const interactiveSel =
          'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="link"], input[type="submit"], input[type="button"], select, [data-track]';
        const nodes = Array.from(document.querySelectorAll(interactiveSel)).slice(0, 120);

        const samples: TrackedElementSample[] = [];
        let missingBoth = 0;
        let missingTrackId = 0;
        let missingTrackOnly = 0;
        const gaps: InteractiveGapSample[] = [];

        for (const el of nodes) {
          const track = el.getAttribute("data-track") || undefined;
          const trackId = el.getAttribute("data-track-id") || undefined;
          const trackRemoval = el.getAttribute("data-track-removal") || undefined;
          const productId = el.getAttribute("data-product-id") || undefined;
          const textSnippet = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);

          const hasTrack = Boolean(track);
          const hasId = Boolean(trackId);
          if (!hasTrack && !hasId) {
            missingBoth++;
            if (gaps.length < 18) {
              gaps.push({ tag: el.tagName.toLowerCase(), textSnippet: textSnippet || "(no text)" });
            }
          } else if (hasTrack && !hasId) {
            missingTrackId++;
          } else if (!hasTrack && hasId) {
            missingTrackOnly++;
          }

          if ((track || trackId || trackRemoval || productId) && samples.length < 80) {
            samples.push({
              tag: el.tagName.toLowerCase(),
              dataTrack: track,
              dataTrackId: trackId,
              dataTrackRemoval: trackRemoval,
              dataProductId: productId,
              textSnippet,
            });
          }
        }

        return {
          dataLayer: dl,
          digitalData: dd,
          adobeSatellitePresent: typeof w._satellite === "object" && w._satellite !== null,
          gtmContainerIds: gtmIds,
          trackedElements: samples,
          digitalDataPagePresent: digitalDataPagePresentInner,
          digitalDataHelperInitPresent: digitalDataHelperInitPresentInner,
          satelliteTrackEventsObserved: trackEv,
          interactiveSampledCount: nodes.length,
          interactiveMissingBothAttrsCount: missingBoth,
          interactiveMissingDataTrackIdCount: missingTrackId,
          interactiveMissingDataTrackOnlyCount: missingTrackOnly,
          interactiveGapSamples: gaps,
          storageKeysSample: { localStorage: lsKeys, sessionStorage: ssKeys },
        };
      });
      dataLayer = extracted.dataLayer;
      digitalData = extracted.digitalData;
      adobeSatellitePresent = extracted.adobeSatellitePresent;
      gtmContainerIds = extracted.gtmContainerIds;
      trackedElements = extracted.trackedElements;
      digitalDataPagePresent = extracted.digitalDataPagePresent;
      digitalDataHelperInitPresent = extracted.digitalDataHelperInitPresent;
      satelliteTrackEventsObserved = extracted.satelliteTrackEventsObserved;
      interactiveSampledCount = extracted.interactiveSampledCount;
      interactiveMissingBothAttrsCount = extracted.interactiveMissingBothAttrsCount;
      interactiveMissingDataTrackIdCount = extracted.interactiveMissingDataTrackIdCount;
      interactiveMissingDataTrackOnlyCount = extracted.interactiveMissingDataTrackOnlyCount;
      interactiveGapSamples = extracted.interactiveGapSamples;
      storageKeysSample = extracted.storageKeysSample;
    } catch (e) {
      pageError = pageError ?? (e instanceof Error ? e.message : String(e));
    }
  }

  const networkRequests = net.entries;
  const failedRequests = net.failures;
  const adobeAnalyticsHits = net.adobeAnalyticsHits;

  await context.close();

  return {
    url,
    finalUrl,
    title,
    fetchedAt,
    loadMs,
    dataLayer,
    digitalData,
    adobeSatellitePresent,
    gtmContainerIds,
    trackedElements,
    consoleErrors: consoleErrors.slice(0, 30),
    pageErrors: pageErrors.slice(0, 15),
    pageError,
    digitalDataPagePresent,
    digitalDataHelperInitPresent,
    satelliteTrackEventsObserved,
    interactiveSampledCount,
    interactiveMissingBothAttrsCount,
    interactiveMissingDataTrackIdCount,
    interactiveMissingDataTrackOnlyCount,
    interactiveGapSamples,
    networkRequests,
    failedRequests,
    storageKeysSample,
    adobeAnalyticsHits,
  };
}
