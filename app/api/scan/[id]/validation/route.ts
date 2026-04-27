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

    const results = db.prepare(
      `SELECT vr.*, i.element_text, i.element_category, i.order_index
       FROM validation_results vr
       LEFT JOIN interactions i ON vr.interaction_id = i.id
       WHERE vr.scan_id IN (${placeholders})
       ORDER BY vr.rowid`,
    ).all(...values) as Array<Record<string, unknown>>;

    const parsed: Array<Record<string, unknown>> = results.map((r) => ({
      ...r,
      errors: r.errors_json ? JSON.parse(r.errors_json as string) : [],
    }));

    const bySchema: Record<string, Array<Record<string, unknown>>> = {};
    for (const r of parsed) {
      const key = r.schema_name as string;
      if (!bySchema[key]) bySchema[key] = [];
      bySchema[key].push(r);
    }

    const summary = {
      pass: parsed.filter((r) => r.status === "pass").length,
      fail: parsed.filter((r) => r.status === "fail").length,
      warn: parsed.filter((r) => r.status === "warn").length,
    };

    return NextResponse.json({ ok: true, results: parsed, bySchema, summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
