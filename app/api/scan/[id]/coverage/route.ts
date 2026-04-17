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

    const snapshot = db.prepare(
      `SELECT * FROM coverage_snapshots WHERE scan_id = ? ORDER BY rowid DESC LIMIT 1`,
    ).get(id) as Record<string, unknown> | undefined;

    if (!snapshot) {
      return NextResponse.json({ error: "No coverage data for this scan" }, { status: 404 });
    }

    const untested = snapshot.untested_json
      ? JSON.parse(snapshot.untested_json as string)
      : [];

    return NextResponse.json({
      ok: true,
      totalElements: snapshot.total_elements,
      testedElements: snapshot.tested_elements,
      coveragePct: snapshot.coverage_pct,
      untestedElements: untested,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
