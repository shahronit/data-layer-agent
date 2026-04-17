import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_sessions (
      id            TEXT PRIMARY KEY,
      url           TEXT NOT NULL,
      started_at    TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at   TEXT,
      status        TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','complete','failed')),
      config_json   TEXT,
      score         INTEGER,
      summary_json  TEXT
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id                 TEXT PRIMARY KEY,
      scan_id            TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
      element_selector   TEXT,
      element_tag        TEXT,
      element_text       TEXT,
      element_category   TEXT,
      interaction_type   TEXT NOT NULL CHECK(interaction_type IN ('click','select','scroll','hover','input')),
      order_index        INTEGER NOT NULL,
      timestamp          TEXT NOT NULL DEFAULT (datetime('now')),
      data_layer_before  TEXT,
      data_layer_after   TEXT,
      diff_json          TEXT,
      screenshot_path    TEXT,
      duration_ms        INTEGER,
      error              TEXT
    );

    CREATE TABLE IF NOT EXISTS captured_events (
      id              TEXT PRIMARY KEY,
      interaction_id  TEXT REFERENCES interactions(id) ON DELETE CASCADE,
      scan_id         TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
      source          TEXT NOT NULL,
      event_name      TEXT NOT NULL,
      payload_json    TEXT,
      timestamp       REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS validation_results (
      id              TEXT PRIMARY KEY,
      event_id        TEXT REFERENCES captured_events(id) ON DELETE CASCADE,
      scan_id         TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
      interaction_id  TEXT REFERENCES interactions(id) ON DELETE CASCADE,
      schema_name     TEXT NOT NULL,
      status          TEXT NOT NULL CHECK(status IN ('pass','fail','warn')),
      errors_json     TEXT
    );

    CREATE TABLE IF NOT EXISTS coverage_snapshots (
      id               TEXT PRIMARY KEY,
      scan_id          TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
      total_elements   INTEGER NOT NULL,
      tested_elements  INTEGER NOT NULL,
      coverage_pct     REAL NOT NULL,
      untested_json    TEXT
    );

    CREATE TABLE IF NOT EXISTS screenshots (
      id              TEXT PRIMARY KEY,
      scan_id         TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
      interaction_id  TEXT REFERENCES interactions(id) ON DELETE CASCADE,
      filepath        TEXT NOT NULL,
      timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journey_steps (
      id           TEXT PRIMARY KEY,
      scan_id      TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
      step_index   INTEGER NOT NULL,
      url          TEXT NOT NULL,
      label        TEXT,
      action_type  TEXT,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','complete','failed')),
      sub_scan_id  TEXT REFERENCES scan_sessions(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_interactions_scan ON interactions(scan_id);
    CREATE INDEX IF NOT EXISTS idx_captured_events_scan ON captured_events(scan_id);
    CREATE INDEX IF NOT EXISTS idx_captured_events_interaction ON captured_events(interaction_id);
    CREATE INDEX IF NOT EXISTS idx_validation_results_scan ON validation_results(scan_id);
    CREATE INDEX IF NOT EXISTS idx_screenshots_scan ON screenshots(scan_id);
    CREATE INDEX IF NOT EXISTS idx_journey_steps_scan ON journey_steps(scan_id);
  `);
}
