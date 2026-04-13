export type FrameworkHint = "gtm" | "adobe" | "tealium" | "any";

export interface TrackedElementSample {
  tag: string;
  dataTrack?: string;
  dataTrackId?: string;
  dataTrackRemoval?: string;
  dataProductId?: string;
  textSnippet: string;
}

/** Clickable sampled but missing data-track / data-track-id (for QA review). */
export interface InteractiveGapSample {
  tag: string;
  textSnippet: string;
}

/** Finished requests (analytics-like URLs or HTTP errors). */
export interface NetworkRequestSample {
  url: string;
  method: string;
  resourceType: string;
  status: number;
}

export interface FailedRequestSample {
  url: string;
  error: string;
}

export interface StorageKeysSample {
  localStorage: string[];
  sessionStorage: string[];
}

/** Decoded Adobe Analytics collection hit (query + form body); not Admin / processing-rule validation. */
export interface AdobeAnalyticsParamRow {
  key: string;
  value: string;
  /** Short hint for common AppMeasurement query keys */
  label?: string;
}

export interface AdobeAnalyticsHitSample {
  urlShort: string;
  method: string;
  status: number;
  reportSuites?: string[];
  params: AdobeAnalyticsParamRow[];
  paramCount: number;
  truncatedParams: boolean;
}

export interface AuditSnapshot {
  url: string;
  finalUrl: string;
  title: string;
  fetchedAt: string;
  loadMs: number;
  dataLayer: unknown[] | null;
  digitalData: Record<string, unknown> | null;
  adobeSatellitePresent: boolean;
  gtmContainerIds: string[];
  trackedElements: TrackedElementSample[];
  consoleErrors: string[];
  /** Uncaught exceptions in the page context */
  pageErrors?: string[];
  pageError?: string;
  /** true when digitalData.page is a non-array object */
  digitalDataPagePresent?: boolean;
  /** true when window.digitalDataHelper?.init is a function */
  digitalDataHelperInitPresent?: boolean;
  /** _satellite.track(eventName) names observed during capture (hooked from page load) */
  satelliteTrackEventsObserved?: string[];
  /** Interactive nodes considered for data-track rules */
  interactiveSampledCount?: number;
  /** Missing both data-track and data-track-id */
  interactiveMissingBothAttrsCount?: number;
  /** Has data-track but no data-track-id */
  interactiveMissingDataTrackIdCount?: number;
  /** Has data-track-id but no data-track */
  interactiveMissingDataTrackOnlyCount?: number;
  interactiveGapSamples?: InteractiveGapSample[];
  /** Analytics / tag-related or error responses observed during capture */
  networkRequests?: NetworkRequestSample[];
  /** Failed script, stylesheet, xhr, fetch */
  failedRequests?: FailedRequestSample[];
  /** Storage key names only (values not read) */
  storageKeysSample?: StorageKeysSample;
  /** Adobe Analytics / AppMeasurement style collection requests with decoded parameters */
  adobeAnalyticsHits?: AdobeAnalyticsHitSample[];
  /** Best-effort string from runtime _satellite (undocumented; may be empty) */
  launchRuntimeSummary?: string | null;
  /** Continuous event stream captured during a headed browser session */
  eventStream?: CapturedEvent[];
}

export type CapturedEventSource = "dataLayer" | "digitalData" | "satellite" | "network";

/** A single event captured during a headed browser session. */
export interface CapturedEvent {
  /** Milliseconds since session start */
  timestamp: number;
  source: CapturedEventSource;
  eventName: string;
  payload: unknown;
  /** URL of the page when the event fired */
  pageUrl: string;
}

export interface CheckResult {
  id: string;
  name: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
}

export interface AuditReport {
  snapshot: AuditSnapshot;
  checks: CheckResult[];
  score: number;
}

/** One row from a multi-URL run */
export interface AuditBatchResultItem {
  url: string;
  ok: boolean;
  error?: string;
  report: AuditReport | null;
}
