import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Lightweight liveness check (no browser launch). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "layerlens",
    time: new Date().toISOString(),
  });
}
