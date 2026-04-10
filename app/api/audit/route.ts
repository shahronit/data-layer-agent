import { NextResponse } from "next/server";
import { z } from "zod";
import { capturePageAudit } from "@/lib/audit-engine";
import type { AuditBatchResultItem } from "@/lib/types";
import { runAutomatedVerification } from "@/lib/verify-rules";

export const runtime = "nodejs";
/** Multi-URL runs are sequential; allow enough time for several pages. */
export const maxDuration = 300;

const MAX_BATCH = 10;

const bodySchema = z
  .object({
    url: z.string().url().optional(),
    urls: z.array(z.string().url()).max(MAX_BATCH).optional(),
    waitAfterLoadMs: z.number().min(0).max(30_000).optional(),
    navigationTimeoutMs: z.number().min(5_000).max(120_000).optional(),
  })
  .superRefine((data, ctx) => {
    const hasUrl = Boolean(data.url?.trim());
    const hasUrls = Boolean(data.urls && data.urls.length > 0);
    if (!hasUrl && !hasUrls) {
      ctx.addIssue({
        code: "custom",
        message: "Provide a single url or a urls array (max 10).",
        path: ["url"],
      });
    }
  });

function normalizeUrlList(data: z.infer<typeof bodySchema>): string[] {
  if (data.urls?.length) {
    return [...new Set(data.urls.map((u) => u.trim()))].slice(0, MAX_BATCH);
  }
  if (data.url?.trim()) {
    return [data.url.trim()];
  }
  return [];
}

const AUDIT_HINTS = [
  "Install Google Chrome and set PLAYWRIGHT_CHROMIUM_CHANNEL=chrome in .env.local",
  "Or run: npm run playwright:install",
  "If cache is broken (sandbox): npm run playwright:install:project",
];

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

  const list = normalizeUrlList(parsed.data);
  if (list.length === 0) {
    return NextResponse.json({ error: "No valid URLs" }, { status: 400 });
  }

  const opts = {
    waitAfterLoadMs: parsed.data.waitAfterLoadMs,
    timeoutMs: parsed.data.navigationTimeoutMs,
  };

  if (list.length === 1) {
    try {
      const snapshot = await capturePageAudit(list[0], opts);
      const report = runAutomatedVerification(snapshot);
      return NextResponse.json({
        ok: true,
        batch: false,
        results: [{ url: list[0], ok: true, report }] satisfies AuditBatchResultItem[],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { ok: false, error: message, hints: AUDIT_HINTS },
        { status: 500 },
      );
    }
  }

  const results: AuditBatchResultItem[] = [];
  for (const u of list) {
    try {
      const snapshot = await capturePageAudit(u, opts);
      const report = runAutomatedVerification(snapshot);
      results.push({ url: u, ok: true, report });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ url: u, ok: false, error: message, report: null });
    }
  }

  return NextResponse.json({
    ok: true,
    batch: true,
    results,
    batchSize: list.length,
  });
}
