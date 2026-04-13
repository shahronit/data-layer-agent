import { NextResponse } from "next/server";
import { z } from "zod";
import {
  captureFromSession,
  captureMultipleFromSession,
  cancelSession,
} from "@/lib/audit-engine";
import type { AuditBatchResultItem } from "@/lib/types";
import { runAutomatedVerification } from "@/lib/verify-rules";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  sessionId: z.string().min(1),
  action: z.enum(["continue", "cancel"]).default("continue"),
  waitAfterLoadMs: z.number().min(0).max(30_000).optional(),
  navigationTimeoutMs: z.number().min(5_000).max(120_000).optional(),
  urls: z.array(z.string().url()).max(10).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sessionId, action, waitAfterLoadMs, navigationTimeoutMs, urls } = parsed.data;

  if (action === "cancel") {
    await cancelSession(sessionId);
    return NextResponse.json({ ok: true, cancelled: true });
  }

  const opts = { waitAfterLoadMs, timeoutMs: navigationTimeoutMs };

  try {
    if (urls && urls.length > 1) {
      const snapshots = await captureMultipleFromSession(sessionId, urls, opts);
      const results: AuditBatchResultItem[] = snapshots.map((snapshot) => {
        if (snapshot.pageError) {
          return { url: snapshot.url, ok: false, error: snapshot.pageError, report: null };
        }
        const report = runAutomatedVerification(snapshot);
        return { url: snapshot.url, ok: true, report };
      });
      return NextResponse.json({
        ok: true,
        batch: true,
        results,
        batchSize: urls.length,
      });
    }

    const snapshot = await captureFromSession(sessionId, opts);
    const report = runAutomatedVerification(snapshot);
    return NextResponse.json({
      ok: true,
      batch: false,
      results: [{ url: snapshot.url, ok: true, report }] satisfies AuditBatchResultItem[],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
