import { runInteractionScan, type ScanResult } from "@/lib/scan-engine";
import { getDb, uid, insertScanSession, finishScanSession, insertJourneyStep, updateJourneyStepStatus } from "@/lib/db/client";
import type { ScanOptions, ScanProgressEvent, JourneyStepConfig } from "@/lib/scan-config";
import { DEFAULT_SCAN_OPTIONS } from "@/lib/scan-config";

export interface JourneyResult {
  journeyId: string;
  steps: Array<{
    stepIndex: number;
    url: string;
    label: string;
    scanResult: ScanResult | null;
    error?: string;
  }>;
  totalDurationMs: number;
}

export async function* runJourney(
  steps: JourneyStepConfig[],
  baseOptions: Partial<ScanOptions>,
): AsyncGenerator<ScanProgressEvent, JourneyResult> {
  const db = getDb();
  const journeyId = uid();
  const startTime = Date.now();

  insertScanSession(db, journeyId, steps.map((s) => s.url).join(" → "), JSON.stringify({ journey: true, steps }));

  yield { type: "phase", scanId: journeyId, message: `Starting journey with ${steps.length} steps` };

  const stepIds: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const stepId = uid();
    stepIds.push(stepId);
    insertJourneyStep(db, {
      id: stepId, scanId: journeyId, stepIndex: i,
      url: steps[i].url, label: steps[i].label,
      actionType: steps[i].interactionDepth, status: "pending", subScanId: null,
    });
  }

  const results: JourneyResult["steps"] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepId = stepIds[i];

    yield { type: "phase", scanId: journeyId, message: `Step ${i + 1}/${steps.length}: ${step.label} (${step.url})` };
    updateJourneyStepStatus(db, stepId, "running");

    try {
      const stepOptions: ScanOptions = {
        ...DEFAULT_SCAN_OPTIONS,
        ...baseOptions,
        url: step.url,
      };

      if (step.interactionDepth === "targeted" && step.targetActions?.length) {
        stepOptions.maxElements = 50;
      }

      // Iterate the generator manually so we can capture its actual return
      // value (a properly-shaped `ScanResult` from `lib/scan-engine.ts`).
      // The previous `for await` loop pulled the result from the `complete`
      // event's `data` payload, but that payload is the human-readable summary
      // (with a `validation` field) — *not* a `ScanResult` (which exposes
      // `validationSummary`, `totalInteractions`, etc.). That mismatch caused
      // "Cannot read properties of undefined (reading 'pass')" when the
      // journey-level reducer tried to aggregate per-step stats.
      let scanResult: ScanResult | null = null;
      const iter = runInteractionScan(stepOptions);
      while (true) {
        const next = await iter.next();
        if (next.done) {
          scanResult = next.value ?? null;
          break;
        }
        const event = next.value;
        yield { ...event, message: `[${step.label}] ${event.message}` };
      }

      updateJourneyStepStatus(db, stepId, "complete", scanResult?.scanId);
      results.push({ stepIndex: i, url: step.url, label: step.label, scanResult });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateJourneyStepStatus(db, stepId, "failed");
      results.push({ stepIndex: i, url: step.url, label: step.label, scanResult: null, error: message });
      yield { type: "error", scanId: journeyId, message: `Step ${step.label} failed: ${message}` };
    }
  }

  const totalDurationMs = Date.now() - startTime;

  // Aggregate a meaningful score and summary for the journey row so the UI
  // does not render an empty placeholder when the user lands on the journey id.
  const stepScores = results
    .map((r) => r.scanResult?.score)
    .filter((s): s is number => typeof s === "number");
  const avgScore = stepScores.length === 0
    ? null
    : Math.round(stepScores.reduce((a, b) => a + b, 0) / stepScores.length);

  const totals = results.reduce(
    (acc, r) => {
      if (r.scanResult) {
        acc.totalInteractions += r.scanResult.totalInteractions ?? 0;
        acc.successfulInteractions += r.scanResult.successfulInteractions ?? 0;
        const vs = r.scanResult.validationSummary ?? { pass: 0, fail: 0, warn: 0 };
        acc.pass += vs.pass ?? 0;
        acc.fail += vs.fail ?? 0;
        acc.warn += vs.warn ?? 0;
      }
      return acc;
    },
    { totalInteractions: 0, successfulInteractions: 0, pass: 0, fail: 0, warn: 0 },
  );

  const summary = {
    journey: true,
    score: avgScore,
    interactions: { total: totals.totalInteractions, successful: totals.successfulInteractions },
    validation: { pass: totals.pass, fail: totals.fail, warn: totals.warn },
    steps: results,
    totalDurationMs,
  };

  finishScanSession(db, journeyId, "complete", avgScore, JSON.stringify(summary));

  yield { type: "complete", scanId: journeyId, message: `Journey complete (${totalDurationMs}ms)`, data: summary as unknown as Record<string, unknown> };

  return { journeyId, steps: results, totalDurationMs };
}
