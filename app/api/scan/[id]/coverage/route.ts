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

    // Pick the most recent snapshot per scan_id, then aggregate.
    const snapshots = db.prepare(
      `SELECT cs.* FROM coverage_snapshots cs
       JOIN (
         SELECT scan_id, MAX(rowid) AS max_rowid
         FROM coverage_snapshots
         WHERE scan_id IN (${placeholders})
         GROUP BY scan_id
       ) latest ON cs.rowid = latest.max_rowid`,
    ).all(...values) as Array<Record<string, unknown>>;

    if (snapshots.length === 0) {
      return NextResponse.json({ error: "No coverage data for this scan" }, { status: 404 });
    }

    let totalElements = 0;
    let testedElements = 0;
    const untested: Array<unknown> = [];
    for (const snap of snapshots) {
      totalElements += (snap.total_elements as number) || 0;
      testedElements += (snap.tested_elements as number) || 0;
      const list = snap.untested_json ? JSON.parse(snap.untested_json as string) : [];
      if (Array.isArray(list)) untested.push(...list);
    }

    const coveragePct = totalElements === 0 ? 0 : Math.round((testedElements / totalElements) * 100);

    return NextResponse.json({
      ok: true,
      totalElements,
      testedElements,
      coveragePct,
      untestedElements: untested,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
