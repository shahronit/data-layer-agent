import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchReportSuiteMetadata, fetchReportSuiteSettings } from "@/lib/adobe-analytics-2-api";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  rsid: z.string().min(1).max(200),
  includeMetadata: z.boolean().optional(),
});

/** Proxies GET …/reportsuites/{rsid}/settings (requires ADOBE_* env). */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await fetchReportSuiteSettings(parsed.data.rsid);
  if (!settings.ok) {
    const code = settings.status === 503 ? 503 : 502;
    return NextResponse.json(
      { ok: false, error: settings.message, status: settings.status },
      { status: code },
    );
  }

  let metadata: unknown | undefined;
  if (parsed.data.includeMetadata) {
    const m = await fetchReportSuiteMetadata(parsed.data.rsid);
    if (m.ok) metadata = m.data;
    else metadata = { error: m.message, status: m.status };
  }

  return NextResponse.json({
    ok: true,
    rsid: parsed.data.rsid,
    settings: settings.data,
    metadata,
  });
}
