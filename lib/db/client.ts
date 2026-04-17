import path from "path";
import Database from "better-sqlite3";
import { runMigrations } from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "layerlens.db");

const store = globalThis as typeof globalThis & { __llDb?: Database.Database };

function ensureDataDir(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getDb(): Database.Database {
  if (store.__llDb) return store.__llDb;
  ensureDataDir();
  const db = new Database(DB_PATH);
  runMigrations(db);
  store.__llDb = db;
  return db;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function insertScanSession(
  db: Database.Database,
  id: string,
  url: string,
  configJson: string,
): void {
  db.prepare(
    `INSERT INTO scan_sessions (id, url, config_json) VALUES (?, ?, ?)`,
  ).run(id, url, configJson);
}

export function finishScanSession(
  db: Database.Database,
  id: string,
  status: "complete" | "failed",
  score: number | null,
  summaryJson: string | null,
): void {
  db.prepare(
    `UPDATE scan_sessions SET status = ?, finished_at = datetime('now'), score = ?, summary_json = ? WHERE id = ?`,
  ).run(status, score, summaryJson, id);
}

export function insertInteraction(
  db: Database.Database,
  row: {
    id: string;
    scanId: string;
    selector: string;
    tag: string;
    text: string;
    category: string;
    type: string;
    orderIndex: number;
    dlBefore: string | null;
    dlAfter: string | null;
    diffJson: string | null;
    screenshotPath: string | null;
    durationMs: number;
    error: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO interactions (id, scan_id, element_selector, element_tag, element_text, element_category, interaction_type, order_index, data_layer_before, data_layer_after, diff_json, screenshot_path, duration_ms, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.scanId,
    row.selector,
    row.tag,
    row.text,
    row.category,
    row.type,
    row.orderIndex,
    row.dlBefore,
    row.dlAfter,
    row.diffJson,
    row.screenshotPath,
    row.durationMs,
    row.error,
  );
}

export function insertCapturedEvent(
  db: Database.Database,
  row: {
    id: string;
    interactionId: string | null;
    scanId: string;
    source: string;
    eventName: string;
    payloadJson: string;
    timestamp: number;
  },
): void {
  db.prepare(
    `INSERT INTO captured_events (id, interaction_id, scan_id, source, event_name, payload_json, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.interactionId, row.scanId, row.source, row.eventName, row.payloadJson, row.timestamp);
}

export function insertValidationResult(
  db: Database.Database,
  row: {
    id: string;
    eventId: string | null;
    scanId: string;
    interactionId: string | null;
    schemaName: string;
    status: "pass" | "fail" | "warn";
    errorsJson: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO validation_results (id, event_id, scan_id, interaction_id, schema_name, status, errors_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.eventId, row.scanId, row.interactionId, row.schemaName, row.status, row.errorsJson);
}

export function insertCoverageSnapshot(
  db: Database.Database,
  row: {
    id: string;
    scanId: string;
    totalElements: number;
    testedElements: number;
    coveragePct: number;
    untestedJson: string;
  },
): void {
  db.prepare(
    `INSERT INTO coverage_snapshots (id, scan_id, total_elements, tested_elements, coverage_pct, untested_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.scanId, row.totalElements, row.testedElements, row.coveragePct, row.untestedJson);
}

export function insertScreenshot(
  db: Database.Database,
  row: { id: string; scanId: string; interactionId: string | null; filepath: string },
): void {
  db.prepare(
    `INSERT INTO screenshots (id, scan_id, interaction_id, filepath) VALUES (?, ?, ?, ?)`,
  ).run(row.id, row.scanId, row.interactionId, row.filepath);
}

export function insertJourneyStep(
  db: Database.Database,
  row: {
    id: string;
    scanId: string;
    stepIndex: number;
    url: string;
    label: string | null;
    actionType: string | null;
    status: string;
    subScanId: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO journey_steps (id, scan_id, step_index, url, label, action_type, status, sub_scan_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.scanId, row.stepIndex, row.url, row.label, row.actionType, row.status, row.subScanId);
}

export function updateJourneyStepStatus(
  db: Database.Database,
  id: string,
  status: string,
  subScanId?: string,
): void {
  if (subScanId) {
    db.prepare(`UPDATE journey_steps SET status = ?, sub_scan_id = ? WHERE id = ?`).run(status, subScanId, id);
  } else {
    db.prepare(`UPDATE journey_steps SET status = ? WHERE id = ?`).run(status, id);
  }
}
