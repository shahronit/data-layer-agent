import { NextResponse } from "next/server";
import fs from "fs";
import { getScreenshotAbsolutePath } from "@/lib/capture/screenshot";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) {
  const { id, file } = await params;
  const relativePath = `${id}/${file}`;
  const absPath = getScreenshotAbsolutePath(relativePath);

  if (!fs.existsSync(absPath)) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(absPath);
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
