import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const db = getDb();

    const session = db.prepare(
      `SELECT * FROM scan_sessions WHERE id = ?`,
    ).get(id) as Record<string, unknown> | undefined;

    if (!session) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const interactions = db.prepare(
      `SELECT id, element_selector, element_tag, element_text, element_category,
              interaction_type, order_index, duration_ms, error, screenshot_path
       FROM interactions WHERE scan_id = ? ORDER BY order_index`,
    ).all(id);

    const eventCount = (db.prepare(
      `SELECT COUNT(*) as count FROM captured_events WHERE scan_id = ?`,
    ).get(id) as { count: number }).count;

    const validationStats = db.prepare(
      `SELECT status, COUNT(*) as count FROM validation_results WHERE scan_id = ? GROUP BY status`,
    ).all(id) as Array<{ status: string; count: number }>;

    const coverage = db.prepare(
      `SELECT * FROM coverage_snapshots WHERE scan_id = ? ORDER BY rowid DESC LIMIT 1`,
    ).get(id);

    const journeySteps = db.prepare(
      `SELECT * FROM journey_steps WHERE scan_id = ? ORDER BY step_index`,
    ).all(id);

    return NextResponse.json({
      ok: true,
      session,
      interactions,
      eventCount,
      validationStats: Object.fromEntries(validationStats.map((v) => [v.status, v.count])),
      coverage,
      journeySteps: journeySteps.length > 0 ? journeySteps : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
