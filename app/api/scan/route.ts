import { NextResponse } from "next/server";
import { z } from "zod";
import { runInteractionScan } from "@/lib/scan-engine";
import { runJourney } from "@/lib/journey/runner";
import { getDb } from "@/lib/db/client";
import { DEFAULT_SCAN_OPTIONS } from "@/lib/scan-config";
import type { ScanOptions } from "@/lib/scan-config";

export const runtime = "nodejs";
export const maxDuration = 600;

const cookieSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
});

const journeyStepSchema = z.object({
  url: z.string().url(),
  label: z.string(),
  interactionDepth: z.enum(["full", "targeted"]).default("full"),
  targetActions: z.array(z.string()).optional(),
});

const bodySchema = z.object({
  url: z.string().url().optional(),
  journey: z.array(journeyStepSchema).min(1).max(10).optional(),
  waitAfterLoadMs: z.number().min(0).max(30_000).optional(),
  navigationTimeoutMs: z.number().min(5_000).max(120_000).optional(),
  maxElements: z.number().min(1).max(500).optional(),
  interactionTimeoutMs: z.number().min(1000).max(30_000).optional(),
  settleTimeMs: z.number().min(500).max(10_000).optional(),
  enableScreenshots: z.boolean().optional(),
  enableAi: z.boolean().optional(),
  schemas: z.array(z.enum(["ga4", "adobe", "custom"])).optional(),
  cookies: z.array(cookieSchema).max(50).optional(),
}).refine(
  (data) => Boolean(data.url?.trim()) || Boolean(data.journey?.length),
  { message: "Provide a url or a journey array", path: ["url"] },
);

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

  const body = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        if (body.journey?.length) {
          const baseOptions: Partial<ScanOptions> = {
            waitAfterLoadMs: body.waitAfterLoadMs ?? DEFAULT_SCAN_OPTIONS.waitAfterLoadMs,
            navigationTimeoutMs: body.navigationTimeoutMs ?? DEFAULT_SCAN_OPTIONS.navigationTimeoutMs,
            maxElements: body.maxElements ?? DEFAULT_SCAN_OPTIONS.maxElements,
            interactionTimeoutMs: body.interactionTimeoutMs ?? DEFAULT_SCAN_OPTIONS.interactionTimeoutMs,
            settleTimeMs: body.settleTimeMs ?? DEFAULT_SCAN_OPTIONS.settleTimeMs,
            enableScreenshots: body.enableScreenshots ?? DEFAULT_SCAN_OPTIONS.enableScreenshots,
            enableAi: body.enableAi ?? DEFAULT_SCAN_OPTIONS.enableAi,
            schemas: body.schemas ?? DEFAULT_SCAN_OPTIONS.schemas,
            cookies: body.cookies,
          };

          for await (const event of runJourney(body.journey, baseOptions)) {
            send(event);
          }
        } else {
          const options: ScanOptions = {
            url: body.url!,
            waitAfterLoadMs: body.waitAfterLoadMs ?? DEFAULT_SCAN_OPTIONS.waitAfterLoadMs,
            navigationTimeoutMs: body.navigationTimeoutMs ?? DEFAULT_SCAN_OPTIONS.navigationTimeoutMs,
            maxElements: body.maxElements ?? DEFAULT_SCAN_OPTIONS.maxElements,
            interactionTimeoutMs: body.interactionTimeoutMs ?? DEFAULT_SCAN_OPTIONS.interactionTimeoutMs,
            settleTimeMs: body.settleTimeMs ?? DEFAULT_SCAN_OPTIONS.settleTimeMs,
            enableScreenshots: body.enableScreenshots ?? DEFAULT_SCAN_OPTIONS.enableScreenshots,
            enableAi: body.enableAi ?? DEFAULT_SCAN_OPTIONS.enableAi,
            schemas: body.schemas ?? DEFAULT_SCAN_OPTIONS.schemas,
            cookies: body.cookies,
          };

          for await (const event of runInteractionScan(options)) {
            send(event);
          }
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  try {
    const db = getDb();
    const sessions = db.prepare(
      `SELECT id, url, started_at, finished_at, status, score, summary_json
       FROM scan_sessions ORDER BY started_at DESC LIMIT 50`,
    ).all();
    return NextResponse.json({ ok: true, sessions });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
