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

      let scanResult: ScanResult | null = null;

      for await (const event of runInteractionScan(stepOptions)) {
        yield { ...event, message: `[${step.label}] ${event.message}` };
        if (event.type === "complete" && event.data) {
          scanResult = event.data as unknown as ScanResult;
        }
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
  finishScanSession(db, journeyId, "complete", null, JSON.stringify({ steps: results, totalDurationMs }));

  yield { type: "complete", scanId: journeyId, message: `Journey complete (${totalDurationMs}ms)` };

  return { journeyId, steps: results, totalDurationMs };
}
