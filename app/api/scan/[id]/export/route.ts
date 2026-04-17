import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";

  try {
    const db = getDb();

    const session = db.prepare(`SELECT * FROM scan_sessions WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!session) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    const interactions = db.prepare(`SELECT * FROM interactions WHERE scan_id = ? ORDER BY order_index`).all(id);
    const events = db.prepare(`SELECT * FROM captured_events WHERE scan_id = ? ORDER BY timestamp`).all(id);
    const validations = db.prepare(`SELECT * FROM validation_results WHERE scan_id = ?`).all(id);
    const coverage = db.prepare(`SELECT * FROM coverage_snapshots WHERE scan_id = ? ORDER BY rowid DESC LIMIT 1`).get(id);
    const screenshots = db.prepare(`SELECT * FROM screenshots WHERE scan_id = ?`).all(id);

    const exportData = {
      exportedAt: new Date().toISOString(),
      session,
      interactions,
      events,
      validations,
      coverage,
      screenshots,
    };

    if (format === "csv") {
      const rows = (interactions as Array<Record<string, unknown>>).map((i) => [
        i.order_index, i.element_tag, i.element_text, i.element_category,
        i.interaction_type, i.duration_ms, i.error || "",
      ].join(","));
      const csv = ["index,tag,text,category,type,duration_ms,error", ...rows].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="scan-${id}.csv"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
