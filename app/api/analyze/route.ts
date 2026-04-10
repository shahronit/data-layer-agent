import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_SYSTEM_INSTRUCTION_ANALYST, buildAiUserContent } from "@/lib/ai-report-defaults";
import { getGeminiApiKey, isGeminiConfigured } from "@/lib/gemini-env";
import type { AuditReport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;
/** Env-based GET must not be statically cached (otherwise "configured" stays false after adding the key). */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  report: z.any(),
  customRules: z.string().max(24_000).optional(),
});

/** Lets the UI show setup hints without treating “no key” as an HTTP error. */
export async function GET() {
  return NextResponse.json(
    { configured: isGeminiConfigured() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}

export async function POST(req: Request) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      code: "GEMINI_NOT_CONFIGURED" as const,
      message:
        "Add GEMINI_API_KEY (or GEMINIAPI_KEY) to .env.local, then restart the dev server. Automated audits do not need it.",
    });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report payload" }, { status: 400 });
  }

  const report = parsed.data.report as AuditReport;
  const { customRules } = parsed.data;

  const dataPayload = {
    automatedScore: report.score,
    checks: report.checks,
    snapshotSummary: {
      url: report.snapshot.url,
      finalUrl: report.snapshot.finalUrl,
      title: report.snapshot.title,
      loadMs: report.snapshot.loadMs,
      fetchedAt: report.snapshot.fetchedAt,
      dataLayerLength: report.snapshot.dataLayer?.length ?? 0,
      digitalDataKeys: report.snapshot.digitalData
        ? Object.keys(report.snapshot.digitalData)
        : [],
      gtmContainerIds: report.snapshot.gtmContainerIds,
      adobeSatellitePresent: report.snapshot.adobeSatellitePresent,
      trackedElementCount: report.snapshot.trackedElements.length,
      sampleTracked: report.snapshot.trackedElements.slice(0, 20),
      lastDataLayerEvents: (report.snapshot.dataLayer ?? []).slice(-12),
      consoleErrorCount: report.snapshot.consoleErrors.length,
      sampleConsoleErrors: report.snapshot.consoleErrors.slice(0, 5),
      pageErrorCount: report.snapshot.pageErrors?.length ?? 0,
      samplePageErrors: (report.snapshot.pageErrors ?? []).slice(0, 3),
      pageLoadError: report.snapshot.pageError ?? null,
      digitalDataPagePresent: report.snapshot.digitalDataPagePresent ?? null,
      digitalDataHelperInitPresent: report.snapshot.digitalDataHelperInitPresent ?? null,
      satelliteTrackEventsObserved: report.snapshot.satelliteTrackEventsObserved ?? [],
      interactiveSampledCount: report.snapshot.interactiveSampledCount ?? 0,
      interactiveMissingBothAttrs: report.snapshot.interactiveMissingBothAttrsCount ?? 0,
      interactiveMissingDataTrackId: report.snapshot.interactiveMissingDataTrackIdCount ?? 0,
      interactiveGapSamples: (report.snapshot.interactiveGapSamples ?? []).slice(0, 8),
      networkBeaconCount: report.snapshot.networkRequests?.length ?? 0,
      networkBeaconSamples: (report.snapshot.networkRequests ?? []).slice(0, 15),
      failedRequestCount: report.snapshot.failedRequests?.length ?? 0,
      failedRequestSamples: (report.snapshot.failedRequests ?? []).slice(0, 10),
      storageLocalKeyCount: report.snapshot.storageKeysSample?.localStorage.length ?? 0,
      storageSessionKeyCount: report.snapshot.storageKeysSample?.sessionStorage.length ?? 0,
      storageLocalKeySample: (report.snapshot.storageKeysSample?.localStorage ?? []).slice(0, 24),
      storageSessionKeySample: (report.snapshot.storageKeysSample?.sessionStorage ?? []).slice(0, 24),
      adobeAnalyticsHitCount: report.snapshot.adobeAnalyticsHits?.length ?? 0,
      adobeAnalyticsFirstHitReportSuites: report.snapshot.adobeAnalyticsHits?.[0]?.reportSuites ?? [],
      launchRuntimeSummary: report.snapshot.launchRuntimeSummary ?? null,
      adobeAnalyticsSampleParams: (report.snapshot.adobeAnalyticsHits?.[0]?.params ?? [])
        .filter((p) => {
          const k = p.key.toLowerCase();
          return (
            k === "events" ||
            k === "pagename" ||
            k === "page" ||
            k === "products" ||
            k === "ch" ||
            k === "campaign" ||
            /^evar\d+$/.test(k) ||
            /^prop\d+$/.test(k)
          );
        })
        .slice(0, 24)
        .map((p) => ({ key: p.key, value: p.value.slice(0, 240), label: p.label })),
    },
  };

  const userText = buildAiUserContent(dataPayload, customRules);

  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-pro";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: AI_SYSTEM_INSTRUCTION_ANALYST,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.25 },
    });
    const text = result.response.text()?.trim() || "";
    return NextResponse.json({ ok: true, markdown: text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
