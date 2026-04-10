import { NextRequest, NextResponse } from "next/server";
import { readAdobeIntegrationEnv } from "@/lib/adobe-integration-env";
import { fetchPropertyRules } from "@/lib/adobe-reactor-api";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET ?propertyId=PR… (or use ADOBE_TAGS_PROPERTY_ID). Requires Reactor auth env. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("propertyId")?.trim();
  const propertyId = q || readAdobeIntegrationEnv().tagsPropertyId;
  if (!propertyId) {
    return NextResponse.json(
      { error: "Set ?propertyId= or ADOBE_TAGS_PROPERTY_ID in server env" },
      { status: 400 },
    );
  }

  const result = await fetchPropertyRules(propertyId);
  if (!result.ok) {
    const code = result.status === 503 ? 503 : 502;
    return NextResponse.json(
      { ok: false, error: result.message, status: result.status },
      { status: code },
    );
  }

  return NextResponse.json({ ok: true, propertyId, rules: result.rules });
}
