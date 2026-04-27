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
    const ids = getEffectiveScanIds(db, id);
    const { placeholders, values } = buildInClause(ids);

    const interactions = db.prepare(
      `SELECT i.*, GROUP_CONCAT(ce.event_name, '||') as event_names
       FROM interactions i
       LEFT JOIN captured_events ce ON ce.interaction_id = i.id
       WHERE i.scan_id IN (${placeholders})
       GROUP BY i.id
       ORDER BY i.scan_id, i.order_index`,
    ).all(...values) as Array<Record<string, unknown>>;

    const detailed = interactions.map((row) => {
      const events = db.prepare(
        `SELECT * FROM captured_events WHERE interaction_id = ?`,
      ).all(row.id as string);

      const validations = db.prepare(
        `SELECT * FROM validation_results WHERE interaction_id = ?`,
      ).all(row.id as string);

      return {
        ...row,
        diff: row.diff_json ? JSON.parse(row.diff_json as string) : null,
        events,
        validations,
      };
    });

    return NextResponse.json({ ok: true, interactions: detailed });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
