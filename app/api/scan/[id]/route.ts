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
      `SELECT * FROM scan_sessions WHERE id = ?`,
    ).get(id) as Record<string, unknown> | undefined;

    if (!session) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const ids = getEffectiveScanIds(db, id);
    const { placeholders, values } = buildInClause(ids);

    const interactions = db.prepare(
      `SELECT id, scan_id, element_selector, element_tag, element_text, element_category,
              interaction_type, order_index, duration_ms, error, screenshot_path
       FROM interactions WHERE scan_id IN (${placeholders}) ORDER BY order_index`,
    ).all(...values);

    const eventCount = (db.prepare(
      `SELECT COUNT(*) as count FROM captured_events WHERE scan_id IN (${placeholders})`,
    ).get(...values) as { count: number }).count;

    const validationStats = db.prepare(
      `SELECT status, COUNT(*) as count FROM validation_results WHERE scan_id IN (${placeholders}) GROUP BY status`,
    ).all(...values) as Array<{ status: string; count: number }>;

    // Aggregate the latest coverage snapshot per scan id, then sum totals.
    const coverageRows = db.prepare(
      `SELECT cs.* FROM coverage_snapshots cs
       JOIN (
         SELECT scan_id, MAX(rowid) AS max_rowid
         FROM coverage_snapshots
         WHERE scan_id IN (${placeholders})
         GROUP BY scan_id
       ) latest ON cs.rowid = latest.max_rowid`,
    ).all(...values) as Array<{
      total_elements: number;
      tested_elements: number;
      coverage_pct: number;
      untested_json: string | null;
    }>;

    const coverage = coverageRows.length === 0
      ? null
      : coverageRows.length === 1
        ? coverageRows[0]
        : {
            total_elements: coverageRows.reduce((s, r) => s + (r.total_elements || 0), 0),
            tested_elements: coverageRows.reduce((s, r) => s + (r.tested_elements || 0), 0),
            coverage_pct: (() => {
              const totals = coverageRows.reduce(
                (acc, r) => {
                  acc.total += r.total_elements || 0;
                  acc.tested += r.tested_elements || 0;
                  return acc;
                },
                { total: 0, tested: 0 },
              );
              return totals.total === 0 ? 0 : Math.round((totals.tested / totals.total) * 100);
            })(),
            untested_json: JSON.stringify(
              coverageRows
                .flatMap((r) => (r.untested_json ? JSON.parse(r.untested_json) : []) as Array<unknown>),
            ),
          };

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
