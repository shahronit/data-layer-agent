import { NextResponse } from "next/server";
import { buildInClause, getDb, getEffectiveScanIds } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const db = getDb();

    const session = db.prepare(
      `SELECT url, started_at, finished_at, status, score FROM scan_sessions WHERE id = ?`,
    ).get(id) as Record<string, unknown> | undefined;

    if (!session) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const ids = getEffectiveScanIds(db, id);
    const { placeholders, values } = buildInClause(ids);

    const interactions = db.prepare(
      `SELECT id, scan_id, element_selector, element_tag, element_text, element_category,
              interaction_type, order_index, timestamp, duration_ms, error,
              diff_json, screenshot_path
       FROM interactions WHERE scan_id IN (${placeholders}) ORDER BY scan_id, order_index`,
    ).all(...values) as Array<Record<string, unknown>>;

    const steps = interactions.map((row, idx) => {
      const events = db.prepare(
        `SELECT source, event_name, payload_json, timestamp
         FROM captured_events WHERE interaction_id = ? ORDER BY timestamp`,
      ).all(row.id as string) as Array<Record<string, unknown>>;

      const screenshots = db.prepare(
        `SELECT filepath FROM screenshots WHERE interaction_id = ?`,
      ).all(row.id as string) as Array<{ filepath: string }>;

      return {
        index: idx,
        scanId: row.scan_id,
        element: {
          selector: row.element_selector,
          tag: row.element_tag,
          text: row.element_text,
          category: row.element_category,
        },
        interactionType: row.interaction_type,
        timestamp: row.timestamp,
        durationMs: row.duration_ms,
        error: row.error,
        diff: row.diff_json ? JSON.parse(row.diff_json as string) : null,
        events: events.map((e) => ({
          ...e,
          payload: e.payload_json ? JSON.parse(e.payload_json as string) : null,
        })),
        screenshots: screenshots.map((s) => s.filepath),
      };
    });

    // Page load events / screenshots: rows with NULL interaction_id, across all effective scans.
    const pageLoadEvents = db.prepare(
      `SELECT source, event_name, payload_json, timestamp
       FROM captured_events
       WHERE scan_id IN (${placeholders}) AND interaction_id IS NULL
       ORDER BY timestamp`,
    ).all(...values) as Array<Record<string, unknown>>;

    const pageLoadScreenshots = db.prepare(
      `SELECT filepath FROM screenshots
       WHERE scan_id IN (${placeholders}) AND interaction_id IS NULL`,
    ).all(...values) as Array<{ filepath: string }>;

    return NextResponse.json({
      ok: true,
      session,
      pageLoad: {
        events: pageLoadEvents.map((e) => ({
          ...e,
          payload: e.payload_json ? JSON.parse(e.payload_json as string) : null,
        })),
        screenshots: pageLoadScreenshots.map((s) => s.filepath),
      },
      steps,
      totalSteps: steps.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
