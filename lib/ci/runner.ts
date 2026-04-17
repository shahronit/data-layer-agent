import { runInteractionScan } from "@/lib/scan-engine";
import { DEFAULT_SCAN_OPTIONS, type ScanOptions } from "@/lib/scan-config";

export interface CIRunOptions {
  url: string;
  schemas?: ("ga4" | "adobe" | "custom")[];
  maxElements?: number;
  minCoverage?: number;
  maxValidationFailures?: number;
  timeoutMs?: number;
}

export interface CIReport {
  scanId: string;
  url: string;
  score: number;
  coverage: number;
  interactions: { total: number; successful: number };
  validation: { pass: number; fail: number; warn: number };
  durationMs: number;
  passed: boolean;
  failReasons: string[];
}

export async function runCIScan(options: CIRunOptions): Promise<CIReport> {
  const scanOptions: ScanOptions = {
    ...DEFAULT_SCAN_OPTIONS,
    url: options.url,
    schemas: options.schemas ?? ["ga4", "adobe"],
    maxElements: options.maxElements ?? 60,
    enableScreenshots: false,
    enableAi: false,
    navigationTimeoutMs: options.timeoutMs ?? 60_000,
  };

  for await (const event of runInteractionScan(scanOptions)) {
    if (event.type === "error") {
      console.error(`[scan] ${event.message}`);
    } else if (event.type === "phase" || event.type === "detection") {
      console.log(`[scan] ${event.message}`);
    }
  }

  const { getDb } = await import("@/lib/db/client");
  const db = getDb();
  const session = db.prepare(
    `SELECT id, score, summary_json FROM scan_sessions ORDER BY rowid DESC LIMIT 1`,
  ).get() as { id: string; score: number | null; summary_json: string | null } | undefined;

  const failReasons: string[] = [];
  const minCoverage = options.minCoverage ?? 0;
  const maxFails = options.maxValidationFailures ?? Infinity;

  let coverage = 0;
  let validation = { pass: 0, fail: 0, warn: 0 };
  let interactions = { total: 0, successful: 0 };
  let score = 0;

  if (session?.summary_json) {
    const summary = JSON.parse(session.summary_json);
    coverage = summary.coverage?.coveragePct ?? 0;
    validation = summary.validation ?? { pass: 0, fail: 0, warn: 0 };
    interactions = summary.interactions ?? { total: 0, successful: 0 };
    score = summary.score ?? 0;
  }

  if (coverage < minCoverage) {
    failReasons.push(`Coverage ${coverage}% is below minimum ${minCoverage}%`);
  }
  if (validation.fail > maxFails) {
    failReasons.push(`${validation.fail} validation failures exceeds maximum ${maxFails}`);
  }

  return {
    scanId: session?.id ?? "",
    url: options.url,
    score,
    coverage,
    interactions,
    validation,
    durationMs: 0,
    passed: failReasons.length === 0,
    failReasons,
  };
}
