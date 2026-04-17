import fs from "fs";
import path from "path";
import type { Page } from "playwright";

const SCREENSHOTS_BASE = path.join(process.cwd(), "data", "screenshots");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function captureFullPageScreenshot(
  page: Page,
  scanId: string,
  label: string,
): Promise<string> {
  const dir = path.join(SCREENSHOTS_BASE, scanId);
  ensureDir(dir);
  const filename = `${label}.png`;
  const filepath = path.join(dir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return `${scanId}/${filename}`;
}

export async function captureInteractionScreenshot(
  page: Page,
  scanId: string,
  interactionIndex: number,
  selector: string,
  phase: "before" | "after",
): Promise<string> {
  const dir = path.join(SCREENSHOTS_BASE, scanId);
  ensureDir(dir);

  if (phase === "before") {
    try {
      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (el) {
          (el as HTMLElement).style.outline = "3px solid #a78bfa";
          (el as HTMLElement).style.outlineOffset = "2px";
        }
      }, selector);
    } catch { /* element may not exist */ }
  }

  const filename = `interaction-${interactionIndex}-${phase}.png`;
  const filepath = path.join(dir, filename);
  await page.screenshot({ path: filepath, fullPage: false });

  if (phase === "before") {
    try {
      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (el) {
          (el as HTMLElement).style.outline = "";
          (el as HTMLElement).style.outlineOffset = "";
        }
      }, selector);
    } catch { /* best effort cleanup */ }
  }

  return `${scanId}/${filename}`;
}

export function getScreenshotAbsolutePath(relativePath: string): string {
  return path.join(SCREENSHOTS_BASE, relativePath);
}

export function screenshotExists(relativePath: string): boolean {
  return fs.existsSync(path.join(SCREENSHOTS_BASE, relativePath));
}
