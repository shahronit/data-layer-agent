import { isAnalyticsBeaconUrl } from "./network-capture";
import type { AuditReport, AuditSnapshot, CheckResult } from "./types";

function scoreChecks(checks: CheckResult[]): number {
  const weights = { pass: 1, warn: 0.6, fail: 0, info: 0.5 };
  const scored = checks.filter((c) => c.status !== "info");
  if (scored.length === 0) return 0;
  const sum = scored.reduce((acc, c) => acc + weights[c.status], 0);
  return Math.round((sum / scored.length) * 100);
}

function stackLooksAdobeLaunch(snapshot: AuditSnapshot): boolean {
  const hasDd = snapshot.digitalData !== null && Object.keys(snapshot.digitalData ?? {}).length > 0;
  return hasDd || snapshot.adobeSatellitePresent;
}

export function runAutomatedVerification(snapshot: AuditSnapshot): AuditReport {
  const checks: CheckResult[] = [];

  if (snapshot.pageError) {
    checks.push({
      id: "page-load",
      name: "Page load",
      status: "fail",
      detail: snapshot.pageError,
    });
    return { snapshot, checks, score: 0 };
  }

  checks.push({
    id: "page-load",
    name: "Page load",
    status: "pass",
    detail: `Loaded in ${snapshot.loadMs}ms → ${snapshot.finalUrl}`,
  });

  const hasDataLayer =
    Array.isArray(snapshot.dataLayer) && snapshot.dataLayer.length > 0;
  checks.push({
    id: "gtm-datalayer",
    name: "Google dataLayer",
    status: hasDataLayer ? "pass" : "warn",
    detail: hasDataLayer
      ? `Found ${snapshot.dataLayer!.length} push(es) / events in window.dataLayer.`
      : "window.dataLayer is missing or empty (common if GTM is absent or loads late).",
  });

  const hasDigitalData =
    snapshot.digitalData !== null && Object.keys(snapshot.digitalData ?? {}).length > 0;
  checks.push({
    id: "adobe-digitaldata",
    name: "digitalData object",
    status: hasDigitalData ? "pass" : "warn",
    detail: hasDigitalData
      ? `window.digitalData has keys: ${Object.keys(snapshot.digitalData!).slice(0, 12).join(", ")}${Object.keys(snapshot.digitalData!).length > 12 ? "…" : ""}.`
      : "window.digitalData not detected before firing tracking (spec: ensure it exists first).",
  });

  if (!hasDigitalData) {
    checks.push({
      id: "digital-data-page",
      name: "digitalData.page block",
      status: "info",
      detail: "No digitalData on this snapshot—skipped check for a finalized digitalData.page object.",
    });
  } else if (snapshot.digitalDataPagePresent) {
    checks.push({
      id: "digital-data-page",
      name: "digitalData.page block",
      status: "pass",
      detail: "digitalData.page is present and looks like an object (align fields with your page template).",
    });
  } else {
    checks.push({
      id: "digital-data-page",
      name: "digitalData.page block",
      status: "warn",
      detail:
        "digitalData exists but digitalData.page is missing or not a plain object. Finalize page-level fields before events.",
    });
  }

  if (!hasDigitalData) {
    checks.push({
      id: "digital-data-helper",
      name: "digitalDataHelper.init",
      status: "info",
      detail: "No digitalData—skipped check for digitalDataHelper.init().",
    });
  } else if (snapshot.digitalDataHelperInitPresent) {
    checks.push({
      id: "digital-data-helper",
      name: "digitalDataHelper.init",
      status: "pass",
      detail: "window.digitalDataHelper.init is available to refresh digitalData when your library loads.",
    });
  } else {
    checks.push({
      id: "digital-data-helper",
      name: "digitalDataHelper.init",
      status: "warn",
      detail:
        "digitalData is present but digitalDataHelper.init was not found. If your standard script provides it, call it before tracking.",
    });
  }

  checks.push({
    id: "satellite",
    name: "Tag command queue (_satellite)",
    status: snapshot.adobeSatellitePresent ? "pass" : "info",
    detail: snapshot.adobeSatellitePresent
      ? "window._satellite is present (use _satellite.track after digitalData is ready)."
      : "window._satellite not found at capture time (Launch may load later—increase wait or retest).",
  });

  const observed = snapshot.satelliteTrackEventsObserved ?? [];
  if (!snapshot.adobeSatellitePresent) {
    checks.push({
      id: "launch-route-view",
      name: "Launch: global-route-view",
      status: "info",
      detail: "_satellite not present—did not evaluate global-route-view for this snapshot.",
    });
  } else if (observed.length === 0) {
    checks.push({
      id: "launch-route-view",
      name: "Launch: global-route-view",
      status: "warn",
      detail:
        "No _satellite.track(...) calls were observed during this run. Your spec expects activity on load/route change—increase wait or interact with the page, then re-check.",
    });
  } else if (!observed.some((e) => e === "global-route-view")) {
    checks.push({
      id: "launch-route-view",
      name: "Launch: global-route-view",
      status: "warn",
      detail: `Observed track calls: ${observed.slice(0, 12).join(", ")}${observed.length > 12 ? "…" : ""} — but not "global-route-view". Spec: call _satellite.track("global-route-view") on every page load and route change.`,
    });
  } else {
    checks.push({
      id: "launch-route-view",
      name: "Launch: global-route-view",
      status: "pass",
      detail: `Observed "global-route-view" among ${observed.length} _satellite.track call(s): ${observed.slice(0, 10).join(", ")}${observed.length > 10 ? "…" : ""}.`,
    });
  }

  checks.push({
    id: "gtm-containers",
    name: "GTM container snippets",
    status: snapshot.gtmContainerIds.length ? "pass" : "info",
    detail:
      snapshot.gtmContainerIds.length > 0
        ? `Detected GTM IDs: ${snapshot.gtmContainerIds.join(", ")}`
        : "No GTM-XXXX pattern found in inline scripts (container may load from external file).",
  });

  const adobeLike = stackLooksAdobeLaunch(snapshot);
  const sampled = snapshot.interactiveSampledCount ?? 0;
  const missingBoth = snapshot.interactiveMissingBothAttrsCount ?? 0;
  const missingIdOnly = snapshot.interactiveMissingDataTrackIdCount ?? 0;
  const missingTrackOnly = snapshot.interactiveMissingDataTrackOnlyCount ?? 0;
  const withTrack = snapshot.trackedElements.filter((e) => e.dataTrack);

  if (adobeLike) {
    if (sampled === 0) {
      checks.push({
        id: "data-track",
        name: "Clickable data-track / data-track-id",
        status: "info",
        detail: "No interactive elements matched the sample selectors.",
      });
    } else if (missingBoth === 0 && missingIdOnly === 0 && missingTrackOnly === 0) {
      checks.push({
        id: "data-track",
        name: "Clickable data-track / data-track-id",
        status: "pass",
        detail: `Sampled ${sampled} interactive elements; each has both data-track and data-track-id (per your Launch-style markup rules in this scan).`,
      });
    } else {
      const gapHint =
        snapshot.interactiveGapSamples?.length && missingBoth > 0
          ? ` Examples missing both: ${snapshot.interactiveGapSamples
              .slice(0, 4)
              .map((g) => `<${g.tag}> ${g.textSnippet.slice(0, 40)}`)
              .join("; ")}.`
          : "";
      checks.push({
        id: "data-track",
        name: "Clickable data-track / data-track-id",
        status: "warn",
        detail: `Sampled ${sampled} clickables: ${missingBoth} lack both attributes; ${missingIdOnly} have data-track only; ${missingTrackOnly} have data-track-id only.${gapHint}`,
      });
    }
  } else {
    checks.push({
      id: "data-track",
      name: "data-track attributes",
      status: withTrack.length ? "pass" : "warn",
      detail: withTrack.length
        ? `Sampled ${withTrack.length} interactive elements with data-track (cap 80).`
        : "No data-track attributes found in sampled interactive elements.",
    });
  }

  const consoleCount = snapshot.consoleErrors.length;
  const pageErrs = snapshot.pageErrors ?? [];
  const pageExcCount = pageErrs.length;

  if (pageExcCount) {
    checks.push({
      id: "page-exceptions",
      name: "Uncaught page exceptions",
      status: "warn",
      detail: `${pageExcCount} uncaught error(s). First: ${pageErrs[0]?.slice(0, 200)}`,
    });
  } else {
    checks.push({
      id: "page-exceptions",
      name: "Uncaught page exceptions",
      status: "pass",
      detail: "No uncaught exceptions in the page during the audit window.",
    });
  }

  if (consoleCount) {
    checks.push({
      id: "console-errors",
      name: "Console errors (page)",
      status: "warn",
      detail: `Captured ${consoleCount} error(s). First: ${snapshot.consoleErrors[0]?.slice(0, 200)}`,
    });
  } else {
    checks.push({
      id: "console-errors",
      name: "Console errors (page)",
      status: "pass",
      detail: "No console errors captured during audit window.",
    });
  }

  const net = snapshot.networkRequests ?? [];
  const beacons = net.filter((n) => isAnalyticsBeaconUrl(n.url));
  const httpErrors = net.filter((n) => n.status >= 400);
  const failed = snapshot.failedRequests ?? [];

  if (beacons.length > 0) {
    checks.push({
      id: "network-beacons",
      name: "Analytics network requests",
      status: "pass",
      detail: `Logged ${beacons.length} beacon-like request(s). Sample status codes: ${beacons
        .slice(0, 6)
        .map((b) => `${b.status}`)
        .join(", ")}.`,
    });
  } else if (stackLooksAdobeLaunch(snapshot) || hasDataLayer) {
    checks.push({
      id: "network-beacons",
      name: "Analytics network requests",
      status: "info",
      detail:
        "No URLs matched our analytics host filters this run (first-party endpoints, consent delays, or longer runs may be needed). Verify in the browser Network panel.",
    });
  } else {
    checks.push({
      id: "network-beacons",
      name: "Analytics network requests",
      status: "info",
      detail: "Tag stack not clearly GTM/Launch-style; network list is for reference only.",
    });
  }

  if (failed.length > 0 || httpErrors.length > 0) {
    const firstFail = failed[0];
    const firstHttp = httpErrors[0];
    checks.push({
      id: "network-errors",
      name: "Failed tag or beacon requests",
      status: "warn",
      detail: `${failed.length} failed request(s); ${httpErrors.length} HTTP error response(s) in log.${
        firstFail ? ` Example: ${firstFail.error} — ${firstFail.url.slice(0, 100)}` : ""
      }${!firstFail && firstHttp ? ` Example: HTTP ${firstHttp.status} — ${firstHttp.url.slice(0, 100)}` : ""}`,
    });
  } else {
    checks.push({
      id: "network-errors",
      name: "Failed tag or beacon requests",
      status: "pass",
      detail: "No failed script/xhr/fetch in the failure log and no 4xx/5xx in captured responses.",
    });
  }

  const lsN = snapshot.storageKeysSample?.localStorage?.length ?? 0;
  const ssN = snapshot.storageKeysSample?.sessionStorage?.length ?? 0;
  checks.push({
    id: "storage-keys",
    name: "Browser storage (key names)",
    status: "pass",
    detail: `localStorage ${lsN} key(s), sessionStorage ${ssN} key(s) recorded (key names only; values not read).`,
  });

  return { snapshot, checks, score: scoreChecks(checks) };
}
