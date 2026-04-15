import type { Browser, BrowserContext, Page } from "playwright";
import { getSharedBrowser, launchHeadedBrowser } from "@/lib/browser-launch";
import { createNetworkCaptureHandlers, isAnalyticsBeaconUrl } from "@/lib/network-capture";
import type {
  AuditSnapshot,
  CapturedEvent,
  CapturedEventSource,
  InteractiveGapSample,
  TrackedElementSample,
} from "./types";

const DEFAULT_TIMEOUT_MS = 45_000;
const DATALAYER_WAIT_CAP_MS = 4_000;
const LOGIN_SESSION_TTL_MS = 10 * 60 * 1000;

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

/* ------------------------------------------------------------------ */
/*  Login session management                                           */
/* ------------------------------------------------------------------ */

interface LoginSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  url: string;
  createdAt: number;
  loginDetected: boolean;
  sessionStartMs: number;
  eventStream: CapturedEvent[];
}

/* Persist sessions on globalThis so they survive Turbopack/HMR re-evaluations. */
const globalStore = globalThis as typeof globalThis & {
  __llLoginSessions?: Map<string, LoginSession>;
};
if (!globalStore.__llLoginSessions) {
  globalStore.__llLoginSessions = new Map();
}
const loginSessions = globalStore.__llLoginSessions;

function generateSessionId(): string {
  return `ll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of loginSessions) {
    if (now - session.createdAt > LOGIN_SESSION_TTL_MS) {
      void session.context.close().catch(() => {});
      void session.browser.close().catch(() => {});
      loginSessions.delete(id);
    }
  }
}

/** Check whether the current page looks like a login page. */
async function detectLoginPage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    if (passwordFields.length > 0) return true;
    const loginKeywords = /sign.?in|log.?in|authenticate|sso|saml|oauth/i;
    const url = window.location.href;
    if (loginKeywords.test(url)) return true;
    const title = document.title;
    if (loginKeywords.test(title)) return true;
    const h1 = document.querySelector("h1");
    if (h1 && loginKeywords.test(h1.textContent || "")) return true;
    return false;
  });
}

/* ------------------------------------------------------------------ */
/*  Event stream capture (headed sessions only)                        */
/* ------------------------------------------------------------------ */

const MAX_STREAM_EVENTS = 500;

function classifyBeaconUrl(url: string): string {
  const u = url.toLowerCase();
  if (/\/b\/ss\//.test(u) || u.includes("omtrdc.net")) return "Adobe Analytics hit";
  if (u.includes("google-analytics.com") || u.includes("analytics.google.com")) return "Google Analytics";
  if (u.includes("googletagmanager.com")) return "Google Tag Manager";
  if (u.includes("demdex.net")) return "Adobe Audience Manager";
  if (u.includes("doubleclick.net")) return "DoubleClick / Google Ads";
  if (u.includes("facebook.com/tr")) return "Meta Pixel";
  if (u.includes("linkedin.com/px")) return "LinkedIn Insight";
  if (u.includes("ads-twitter.com")) return "Twitter/X Ads";
  if (u.includes("segment.io") || u.includes("segment.com")) return "Segment";
  if (u.includes("cdn.amplitude.com")) return "Amplitude";
  if (u.includes("hotjar.com")) return "Hotjar";
  if (u.includes("clarity.ms")) return "Microsoft Clarity";
  if (u.includes("mixpanel.com")) return "Mixpanel";
  if (u.includes("plausible.io")) return "Plausible";
  if (u.includes("matomo")) return "Matomo";
  return "Analytics beacon";
}

/**
 * Install in-page hooks via addInitScript to capture dataLayer pushes,
 * digitalData mutations, and _satellite.track calls. Events are sent
 * back to Node.js via an exposed function so they survive page navigations.
 */
async function installEventStreamCapture(
  page: Page,
  events: CapturedEvent[],
  sessionStartMs: number,
): Promise<void> {
  await page.exposeFunction(
    "__llPushEvent",
    (source: string, eventName: string, payload: unknown, pageUrl: string) => {
      if (events.length >= MAX_STREAM_EVENTS) return;
      events.push({
        timestamp: Date.now() - sessionStartMs,
        source: source as CapturedEventSource,
        eventName,
        payload,
        pageUrl,
      });
    },
  );

  await page.addInitScript(() => {
    const w = window as Window & {
      __llPushEvent?: (s: string, n: string, p: unknown, u: string) => void;
      __llDlPushPatched?: boolean;
      __llDdLastSnapshot?: string;
      __llSatTrackPatched?: boolean;
      __llTrackEvents?: string[];
    };

    w.__llTrackEvents = [];

    function push(source: string, eventName: string, payload: unknown) {
      if (!w.__llPushEvent) return;
      try {
        const serialized = JSON.parse(JSON.stringify(payload));
        w.__llPushEvent(source, eventName, serialized, window.location.href);
      } catch {
        w.__llPushEvent(source, eventName, { _note: "not serializable" }, window.location.href);
      }
    }

    const patchDataLayer = () => {
      try {
        const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
        if (!dl || !Array.isArray(dl) || w.__llDlPushPatched) return;
        w.__llDlPushPatched = true;
        for (const entry of dl) {
          const evName =
            entry && typeof entry === "object" && "event" in (entry as Record<string, unknown>)
              ? String((entry as Record<string, unknown>).event)
              : "dataLayer.push";
          push("dataLayer", evName, entry);
        }
        const origPush = dl.push.bind(dl);
        dl.push = function (...args: unknown[]) {
          for (const arg of args) {
            const evName =
              arg && typeof arg === "object" && "event" in (arg as Record<string, unknown>)
                ? String((arg as Record<string, unknown>).event)
                : "dataLayer.push";
            push("dataLayer", evName, arg);
          }
          return origPush(...args);
        };
      } catch {
        /* ignore */
      }
    };

    let ddLastSnap = "";
    const pollDigitalData = () => {
      try {
        const dd = (window as unknown as { digitalData?: Record<string, unknown> }).digitalData;
        if (!dd || typeof dd !== "object") return;
        const snap = JSON.stringify(dd);
        if (!ddLastSnap) {
          ddLastSnap = snap;
          for (const key of Object.keys(dd)) {
            push("digitalData", `digitalData.${key}`, dd[key]);
          }
          return;
        }
        if (snap !== ddLastSnap) {
          const prev = JSON.parse(ddLastSnap) as Record<string, unknown>;
          for (const key of Object.keys(dd)) {
            if (JSON.stringify(dd[key]) !== JSON.stringify(prev[key])) {
              push("digitalData", `digitalData.${key}`, dd[key]);
            }
          }
          ddLastSnap = snap;
        }
      } catch {
        /* ignore */
      }
    };

    const patchSatellite = () => {
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
          const n = String(name);
          const arr = w.__llTrackEvents!;
          if (arr.length < 100) arr.push(n);
          push("satellite", n, { trackName: n, args: rest.length ? rest : undefined });
          return orig(name, ...rest);
        };
      } catch {
        /* ignore */
      }
    };

    patchDataLayer();
    pollDigitalData();
    patchSatellite();
    const iv = window.setInterval(() => {
      patchDataLayer();
      pollDigitalData();
      patchSatellite();
    }, 300);
    window.setTimeout(() => window.clearInterval(iv), 10 * 60 * 1000);
  });
}

/** Attach Playwright-side network listener that feeds beacon hits into the event stream. */
function attachNetworkEventCapture(
  page: Page,
  events: CapturedEvent[],
  sessionStartMs: number,
): void {
  page.on("requestfinished", async (request) => {
    if (events.length >= MAX_STREAM_EVENTS) return;
    try {
      const url = request.url();
      if (!isAnalyticsBeaconUrl(url)) return;
      const response = await request.response().catch(() => null);
      const status = response?.status() ?? 0;
      events.push({
        timestamp: Date.now() - sessionStartMs,
        source: "network",
        eventName: classifyBeaconUrl(url),
        payload: {
          url: url.length > 220 ? url.slice(0, 220) + "\u2026" : url,
          method: request.method(),
          status,
          resourceType: request.resourceType(),
        },
        pageUrl: page.url(),
      });
    } catch {
      /* ignore */
    }
  });
}

/**
 * Phase 1: Open a visible browser, navigate to the URL, and check if
 * a login page is shown. Returns a sessionId and whether login was detected.
 */
export async function openBrowserForAudit(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ sessionId: string; loginDetected: boolean; pageTitle: string; currentUrl: string }> {
  cleanupExpiredSessions();

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const browser = await launchHeadedBrowser();
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const sessionStartMs = Date.now();
  const eventStream: CapturedEvent[] = [];

  await installEventStreamCapture(page, eventStream, sessionStartMs);
  attachNetworkEventCapture(page, eventStream, sessionStartMs);

  await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
  const loginDetected = await detectLoginPage(page);
  const pageTitle = await page.title();
  const currentUrl = page.url();

  const sessionId = generateSessionId();
  loginSessions.set(sessionId, {
    browser,
    context,
    page,
    url,
    createdAt: Date.now(),
    loginDetected,
    sessionStartMs,
    eventStream,
  });

  return { sessionId, loginDetected, pageTitle, currentUrl };
}

/**
 * Phase 2: After the user has logged in (or if no login was needed),
 * capture the data-layer snapshot from the current page state (without
 * re-navigating) and include the accumulated event stream.
 */
export async function captureFromSession(
  sessionId: string,
  options: { waitAfterLoadMs?: number; timeoutMs?: number } = {},
): Promise<AuditSnapshot> {
  const session = loginSessions.get(sessionId);
  if (!session) {
    throw new Error("Login session expired or not found. Please run the check again.");
  }
  loginSessions.delete(sessionId);

  const { browser, context, page, eventStream } = session;
  const waitAfterLoadMs = options.waitAfterLoadMs ?? 2500;

  try {
    const snapshot = await captureCurrentPageSnapshot(page, waitAfterLoadMs);
    snapshot.eventStream = [...eventStream].sort((a, b) => a.timestamp - b.timestamp);
    return snapshot;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * Phase 2 (batch): Navigate to each URL in the list using the same
 * authenticated browser session. Returns one snapshot per URL, each
 * with the full event stream accumulated across the entire session.
 */
export async function captureMultipleFromSession(
  sessionId: string,
  urls: string[],
  options: { waitAfterLoadMs?: number; timeoutMs?: number } = {},
): Promise<AuditSnapshot[]> {
  const session = loginSessions.get(sessionId);
  if (!session) {
    throw new Error("Login session expired or not found. Please run the check again.");
  }
  loginSessions.delete(sessionId);

  const { browser, context, page, eventStream } = session;
  const waitAfterLoadMs = options.waitAfterLoadMs ?? 2500;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const snapshots: AuditSnapshot[] = [];

  try {
    for (const url of urls) {
      try {
        const snapshot = await captureSessionUrl(page, url, waitAfterLoadMs, timeoutMs);
        snapshot.eventStream = [...eventStream].sort((a, b) => a.timestamp - b.timestamp);
        snapshots.push(snapshot);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        snapshots.push({
          url,
          finalUrl: url,
          title: "",
          fetchedAt: new Date().toISOString(),
          loadMs: 0,
          dataLayer: null,
          digitalData: null,
          adobeSatellitePresent: false,
          gtmContainerIds: [],
          trackedElements: [],
          consoleErrors: [],
          pageError: errMsg,
          eventStream: [...eventStream].sort((a, b) => a.timestamp - b.timestamp),
        });
      }
    }
    return snapshots;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * Navigate to a URL within an existing session page, wait for tags,
 * then extract a snapshot. Used by captureMultipleFromSession.
 */
async function captureSessionUrl(
  page: Page,
  url: string,
  waitAfterLoadMs: number,
  timeoutMs: number,
): Promise<AuditSnapshot> {
  const fetchedAt = new Date().toISOString();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  const net = createNetworkCaptureHandlers();
  net.attach(page);

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const started = Date.now();
  let finalUrl = url;
  let title = "";
  let pageError: string | undefined;

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

  return extractSnapshot(page, net, {
    url,
    finalUrl,
    title,
    fetchedAt,
    loadMs,
    pageError,
    consoleErrors,
    pageErrors,
  });
}

/**
 * Cancel an open login session (user clicked cancel or navigated away).
 */
export async function cancelSession(sessionId: string): Promise<void> {
  const session = loginSessions.get(sessionId);
  if (!session) return;
  loginSessions.delete(sessionId);
  await session.context.close().catch(() => {});
  await session.browser.close().catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Current-page snapshot (headed session, no re-navigation)           */
/* ------------------------------------------------------------------ */

async function captureCurrentPageSnapshot(
  page: Page,
  waitAfterLoadMs: number,
): Promise<AuditSnapshot> {
  const fetchedAt = new Date().toISOString();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  const net = createNetworkCaptureHandlers();
  net.attach(page);

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  const started = Date.now();
  const currentUrl = page.url();
  let title = "";
  try {
    title = await page.title();
  } catch {
    /* page may have navigated */
  }

  const budget = Math.min(3000, Math.max(800, Math.floor(waitAfterLoadMs * 0.4)));
  await waitForTagReadiness(page, budget);
  const remainder = Math.max(300, waitAfterLoadMs - budget);
  await new Promise((r) => setTimeout(r, remainder));

  const loadMs = Date.now() - started;

  return extractSnapshot(page, net, {
    url: currentUrl,
    finalUrl: currentUrl,
    title,
    fetchedAt,
    loadMs,
    consoleErrors,
    pageErrors,
  });
}

/* ------------------------------------------------------------------ */
/*  Shared page capture logic (headless / multi-URL)                   */
/* ------------------------------------------------------------------ */

async function captureFromPage(
  page: Page,
  context: BrowserContext,
  url: string,
  waitAfterLoadMs: number,
  timeoutMs: number,
): Promise<AuditSnapshot> {
  const fetchedAt = new Date().toISOString();
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
  return extractSnapshot(page, net, {
    url,
    finalUrl,
    title,
    fetchedAt,
    loadMs,
    pageError,
    consoleErrors,
    pageErrors,
  });
}

/* ------------------------------------------------------------------ */
/*  Original headless flow (unchanged for public URLs)                 */
/* ------------------------------------------------------------------ */

export interface CookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export async function capturePageAudit(
  url: string,
  options: { waitAfterLoadMs?: number; timeoutMs?: number; cookies?: CookieEntry[] } = {},
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

  if (options.cookies?.length) {
    const parsedUrl = new URL(url);
    const playwrightCookies = options.cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || parsedUrl.hostname,
      path: c.path || "/",
    }));
    await context.addCookies(playwrightCookies);
  }
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

  const snapshot = await extractSnapshot(page, net, {
    url,
    finalUrl,
    title,
    fetchedAt,
    loadMs,
    pageError,
    consoleErrors,
    pageErrors,
  });

  await context.close();
  return snapshot;
}

/* ------------------------------------------------------------------ */
/*  Extract snapshot data from a loaded page                           */
/* ------------------------------------------------------------------ */

async function extractSnapshot(
  page: Page,
  net: ReturnType<typeof createNetworkCaptureHandlers>,
  meta: {
    url: string;
    finalUrl: string;
    title: string;
    fetchedAt: string;
    loadMs: number;
    pageError?: string;
    consoleErrors: string[];
    pageErrors: string[];
  },
): Promise<AuditSnapshot> {
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
  let launchRuntimeSummary: string | null = null;
  let pageError = meta.pageError;

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

        let launchRuntimeSummary: string | null = null;
        try {
          const sat = (w as unknown as { _satellite?: Record<string, unknown> })._satellite;
          if (sat && typeof sat === "object") {
            const bits: string[] = [];
            if (typeof sat.version === "string") bits.push(`runtime ${sat.version}`);
            const bi = sat.buildInfo as Record<string, unknown> | undefined;
            if (bi && typeof bi === "object") {
              const d = bi.turbineBuildDate ?? bi.buildDate;
              if (typeof d === "string") bits.push(`build ${d}`);
            }
            launchRuntimeSummary = bits.length
              ? bits.join(" · ")
              : "Launch library present (full rule list uses Tags API or Experience Platform Debugger)";
          }
        } catch {
          launchRuntimeSummary = null;
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
          launchRuntimeSummary,
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
      launchRuntimeSummary = extracted.launchRuntimeSummary ?? null;
    } catch (e) {
      pageError = pageError ?? (e instanceof Error ? e.message : String(e));
    }
  }

  const networkRequests = net.entries;
  const failedRequests = net.failures;
  const adobeAnalyticsHits = net.adobeAnalyticsHits;

  return {
    url: meta.url,
    finalUrl: meta.finalUrl,
    title: meta.title,
    fetchedAt: meta.fetchedAt,
    loadMs: meta.loadMs,
    dataLayer,
    digitalData,
    adobeSatellitePresent,
    gtmContainerIds,
    trackedElements,
    consoleErrors: meta.consoleErrors.slice(0, 30),
    pageErrors: meta.pageErrors.slice(0, 15),
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
    launchRuntimeSummary,
  };
}
