import type { Browser, BrowserContext, Page } from "playwright";
import { getSharedBrowser } from "./browser-launch";
import { detectInteractiveElements } from "./interaction/detector";
import { buildInteractionPlan, detectModalOpened, closeModal } from "./interaction/planner";
import { executeInteraction } from "./interaction/executor";
import { EventCaptureSession } from "./capture/event-capture";
import { captureFullPageScreenshot, captureInteractionScreenshot } from "./capture/screenshot";
import { SchemaRegistry, validateEvents } from "./validation/validator";
import { CoverageTracker } from "./coverage/tracker";
import {
  getDb, uid, insertScanSession, finishScanSession,
  insertInteraction, insertCapturedEvent, insertValidationResult,
  insertCoverageSnapshot, insertScreenshot,
} from "./db/client";
import { isAnalyticsBeaconUrl } from "./network-capture";
import { runAutomatedVerification } from "./verify-rules";
import type { ScanOptions, ScanProgressEvent } from "./scan-config";
import type { AuditSnapshot, CapturedEvent, CapturedEventSource } from "./types";

export interface ScanResult {
  scanId: string;
  url: string;
  score: number;
  totalInteractions: number;
  successfulInteractions: number;
  coveragePct: number;
  validationSummary: { pass: number; fail: number; warn: number };
  durationMs: number;
}

async function extractPageLoadSnapshot(page: Page): Promise<AuditSnapshot> {
  const fetchedAt = new Date().toISOString();
  const started = Date.now();
  const currentUrl = page.url();
  let title = "";
  try { title = await page.title(); } catch { /* */ }

  const extracted = await page.evaluate(() => {
    const w = window as Window & {
      dataLayer?: unknown[];
      digitalData?: Record<string, unknown>;
      _satellite?: unknown;
      digitalDataHelper?: { init?: unknown };
      __llTrackEvents?: string[];
    };

    const dl = Array.isArray(w.dataLayer) ? [...w.dataLayer] : null;
    let dd: Record<string, unknown> | null = null;
    if (w.digitalData && typeof w.digitalData === "object") {
      try { dd = JSON.parse(JSON.stringify(w.digitalData)); } catch { dd = null; }
    }

    const scripts = Array.from(document.querySelectorAll("script")).map((s) => s.textContent || "");
    const gtmMatches = scripts.join("\n").match(/GTM-[A-Z0-9]+/g) || [];

    const lsKeys: string[] = [];
    const ssKeys: string[] = [];
    try { for (let i = 0; i < localStorage.length && lsKeys.length < 48; i++) { const k = localStorage.key(i); if (k) lsKeys.push(k); } } catch { /**/ }
    try { for (let i = 0; i < sessionStorage.length && ssKeys.length < 48; i++) { const k = sessionStorage.key(i); if (k) ssKeys.push(k); } } catch { /**/ }

    return {
      dataLayer: dl,
      digitalData: dd,
      adobeSatellitePresent: typeof w._satellite === "object" && w._satellite !== null,
      gtmContainerIds: [...new Set(gtmMatches)],
      trackedElements: [],
      digitalDataPagePresent: !!(w.digitalData && typeof w.digitalData === "object" && w.digitalData.page && typeof w.digitalData.page === "object"),
      digitalDataHelperInitPresent: typeof w.digitalDataHelper?.init === "function",
      satelliteTrackEventsObserved: Array.isArray(w.__llTrackEvents) ? [...w.__llTrackEvents] : [],
      storageKeysSample: { localStorage: lsKeys, sessionStorage: ssKeys },
    };
  });

  return {
    url: currentUrl,
    finalUrl: currentUrl,
    title,
    fetchedAt,
    loadMs: Date.now() - started,
    ...extracted,
    consoleErrors: [],
    networkRequests: [],
    failedRequests: [],
    interactiveSampledCount: 0,
    interactiveMissingBothAttrsCount: 0,
    interactiveMissingDataTrackIdCount: 0,
    interactiveMissingDataTrackOnlyCount: 0,
    interactiveGapSamples: [],
    adobeAnalyticsHits: [],
  };
}

export async function* runInteractionScan(
  options: ScanOptions,
): AsyncGenerator<ScanProgressEvent, ScanResult> {
  const db = getDb();
  const scanId = uid();
  const startTime = Date.now();

  insertScanSession(db, scanId, options.url, JSON.stringify(options));
  yield { type: "phase", scanId, message: "Scan started", data: { url: options.url } };

  let browser: Browser;
  let context: BrowserContext;

  try {
    browser = await getSharedBrowser();

    context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LayerLens/2.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    if (options.cookies?.length) {
      const parsedUrl = new URL(options.url);
      const playwrightCookies = options.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || parsedUrl.hostname,
        path: c.path || "/",
      }));
      await context.addCookies(playwrightCookies);
    }

    const page = await context.newPage();
    const capture = new EventCaptureSession(page);
    await capture.install();

    // Network beacon capture for event stream
    const networkEvents: CapturedEvent[] = [];
    const netStart = Date.now();
    page.on("requestfinished", async (req) => {
      try {
        const url = req.url();
        if (!isAnalyticsBeaconUrl(url)) return;
        const res = await req.response().catch(() => null);
        networkEvents.push({
          timestamp: Date.now() - netStart,
          source: "network" as CapturedEventSource,
          eventName: url.includes("/b/ss/") ? "Adobe Analytics hit" : "Analytics beacon",
          payload: { url: url.slice(0, 220), method: req.method(), status: res?.status() ?? 0 },
          pageUrl: page.url(),
        });
      } catch { /**/ }
    });

    yield { type: "phase", scanId, message: "Navigating to page..." };
    await page.goto(options.url, { waitUntil: "load", timeout: options.navigationTimeoutMs });
    await new Promise((r) => setTimeout(r, options.waitAfterLoadMs));

    yield { type: "phase", scanId, message: "Capturing page load snapshot..." };
    const pageLoadSnapshot = await extractPageLoadSnapshot(page);

    if (options.enableScreenshots) {
      const ssPath = await captureFullPageScreenshot(page, scanId, "page-load");
      insertScreenshot(db, { id: uid(), scanId, interactionId: null, filepath: ssPath });
    }

    // Store page-load events
    const pageLoadEvents = capture.getAllEvents();
    for (const ev of pageLoadEvents) {
      insertCapturedEvent(db, {
        id: uid(), interactionId: null, scanId,
        source: ev.source, eventName: ev.eventName,
        payloadJson: JSON.stringify(ev.payload), timestamp: ev.timestamp,
      });
    }

    yield { type: "phase", scanId, message: "Detecting interactive elements..." };
    const elements = await detectInteractiveElements(page, options.maxElements);
    const plan = buildInteractionPlan(elements, options.maxElements);

    yield {
      type: "detection", scanId,
      message: `Found ${plan.totalDetected} elements, ${plan.ordered.length} planned for interaction`,
      data: { total: plan.totalDetected, planned: plan.ordered.length, skipped: plan.skippedDuplicates },
    };

    const coverage = new CoverageTracker();
    coverage.registerDetected(elements);

    const registry = new SchemaRegistry(options.schemas);
    const validationSummary = { pass: 0, fail: 0, warn: 0 };
    let successfulInteractions = 0;

    yield { type: "phase", scanId, message: "Starting interactions..." };

    for (let i = 0; i < plan.ordered.length; i++) {
      const element = plan.ordered[i];

      yield {
        type: "interaction", scanId,
        message: `[${i + 1}/${plan.ordered.length}] ${element.interactionType} on <${element.tag}> "${element.text.slice(0, 40)}"`,
        data: { index: i, total: plan.ordered.length, element: { tag: element.tag, text: element.text.slice(0, 60), category: element.category } },
      };

      let screenshotBefore: string | null = null;
      if (options.enableScreenshots) {
        try {
          screenshotBefore = await captureInteractionScreenshot(page, scanId, i, element.selector, "before");
        } catch { /**/ }
      }

      const result = await executeInteraction(page, element, capture, options.settleTimeMs, options.interactionTimeoutMs);
      coverage.markTested(element.selector, result.success);

      let screenshotAfter: string | null = null;
      if (options.enableScreenshots && result.success) {
        try {
          screenshotAfter = await captureInteractionScreenshot(page, scanId, i, element.selector, "after");
        } catch { /**/ }
      }

      const interactionId = uid();
      insertInteraction(db, {
        id: interactionId, scanId, selector: element.selector, tag: element.tag,
        text: element.text.slice(0, 200), category: element.category,
        type: element.interactionType, orderIndex: i,
        dlBefore: JSON.stringify(result.diff.dataLayerChanges),
        dlAfter: null,
        diffJson: JSON.stringify(result.diff),
        screenshotPath: screenshotAfter ?? screenshotBefore,
        durationMs: result.durationMs, error: result.error ?? null,
      });

      if (screenshotBefore) insertScreenshot(db, { id: uid(), scanId, interactionId, filepath: screenshotBefore });
      if (screenshotAfter) insertScreenshot(db, { id: uid(), scanId, interactionId, filepath: screenshotAfter });

      for (const ev of result.diff.newEvents) {
        const evId = uid();
        insertCapturedEvent(db, {
          id: evId, interactionId, scanId,
          source: ev.source, eventName: ev.eventName,
          payloadJson: JSON.stringify(ev.payload), timestamp: ev.timestamp,
        });
      }

      if (result.success) {
        successfulInteractions++;
        const validationResults = validateEvents(result.diff.newEvents, registry);
        for (const vr of validationResults) {
          validationSummary[vr.status]++;
          insertValidationResult(db, {
            id: uid(), eventId: null, scanId, interactionId,
            schemaName: vr.schemaName, status: vr.status,
            errorsJson: vr.errors.length > 0 ? JSON.stringify(vr.errors) : null,
          });
        }
      }

      // Check for modals and handle them
      try {
        const modalOpen = await detectModalOpened(page);
        if (modalOpen) {
          await closeModal(page);
        }
      } catch { /**/ }
    }

    // Also validate page-load events
    const pageLoadValidation = validateEvents(pageLoadEvents, registry);
    for (const vr of pageLoadValidation) {
      validationSummary[vr.status]++;
      insertValidationResult(db, {
        id: uid(), eventId: null, scanId, interactionId: null,
        schemaName: vr.schemaName, status: vr.status,
        errorsJson: vr.errors.length > 0 ? JSON.stringify(vr.errors) : null,
      });
    }

    yield { type: "phase", scanId, message: "Computing coverage..." };
    const coverageReport = coverage.getReport();
    insertCoverageSnapshot(db, {
      id: uid(), scanId,
      totalElements: coverageReport.totalInteractiveElements,
      testedElements: coverageReport.testedElements,
      coveragePct: coverageReport.coveragePct,
      untestedJson: JSON.stringify(coverageReport.untestedElements),
    });

    yield {
      type: "coverage", scanId,
      message: `Coverage: ${coverageReport.coveragePct}% (${coverageReport.testedElements}/${coverageReport.totalInteractiveElements})`,
      data: coverageReport as unknown as Record<string, unknown>,
    };

    // Run legacy verification for backward-compatible score
    const legacyReport = runAutomatedVerification(pageLoadSnapshot);

    const score = legacyReport.score;
    const summary = {
      score,
      interactions: { total: plan.ordered.length, successful: successfulInteractions },
      coverage: coverageReport,
      validation: validationSummary,
      pageLoad: { url: pageLoadSnapshot.url, title: pageLoadSnapshot.title, loadMs: pageLoadSnapshot.loadMs },
    };

    finishScanSession(db, scanId, "complete", score, JSON.stringify(summary));

    yield { type: "complete", scanId, message: "Scan complete", data: summary };

    await context.close().catch(() => {});

    return {
      scanId,
      url: options.url,
      score,
      totalInteractions: plan.ordered.length,
      successfulInteractions,
      coveragePct: coverageReport.coveragePct,
      validationSummary,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try { finishScanSession(db, scanId, "failed", null, JSON.stringify({ error: message })); } catch { /* db may also fail */ }
    yield { type: "error", scanId, message: `Scan failed: ${message}` };
    return {
      scanId,
      url: options.url,
      score: 0,
      totalInteractions: 0,
      successfulInteractions: 0,
      coveragePct: 0,
      validationSummary: { pass: 0, fail: 0, warn: 0 },
      durationMs: Date.now() - startTime,
    };
  }
}
