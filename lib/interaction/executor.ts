import type { Page } from "playwright";
import type { DetectedElement } from "./detector";
import type { EventCaptureSession } from "@/lib/capture/event-capture";
import type { EventDiff } from "@/lib/capture/event-diff";
import { computeEventDiff } from "@/lib/capture/event-diff";

export interface InteractionResult {
  element: DetectedElement;
  success: boolean;
  durationMs: number;
  diff: EventDiff;
  error?: string;
  newElementsDetected: number;
}

const MAX_RETRIES = 2;

async function waitForSettle(page: Page, timeoutMs: number): Promise<void> {
  const start = Date.now();
  try {
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 2000) });
  } catch {
    /* network may never go idle — continue */
  }
  const remaining = timeoutMs - (Date.now() - start);
  if (remaining > 200) {
    await new Promise((r) => setTimeout(r, Math.min(remaining, 800)));
  }
}

async function scrollIntoView(page: Page, selector: string): Promise<void> {
  try {
    await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, selector);
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    /* best effort */
  }
}

async function executeClick(page: Page, selector: string, timeoutMs: number): Promise<void> {
  const locator = page.locator(selector).first();
  await locator.click({ timeout: timeoutMs, force: false });
}

async function executeSelect(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector).first();
  const options = await locator.evaluate((el) => {
    if (el.tagName.toLowerCase() !== "select") return [];
    const select = el as HTMLSelectElement;
    return Array.from(select.options)
      .filter((o) => !o.selected && !o.disabled && o.value)
      .map((o) => o.value);
  });
  if (options.length > 0) {
    await locator.selectOption(options[0]);
  } else {
    await locator.click({ timeout: 3000 });
  }
}

async function executeInput(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector).first();
  await locator.fill("test");
  await locator.press("Enter");
}

async function executeScroll(page: Page): Promise<void> {
  await page.mouse.wheel(0, 600);
  await new Promise((r) => setTimeout(r, 1000));
}

export async function executeInteraction(
  page: Page,
  element: DetectedElement,
  capture: EventCaptureSession,
  settleTimeMs: number = 3000,
  interactionTimeoutMs: number = 5000,
): Promise<InteractionResult> {
  const start = Date.now();
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await scrollIntoView(page, element.selector);

      const beforeSnap = await capture.snapshotDataLayer();
      const beforeDigital = await capture.snapshotDigitalData();
      const beforeTimestamp = Date.now();

      switch (element.interactionType) {
        case "click":
          await executeClick(page, element.selector, interactionTimeoutMs);
          break;
        case "select":
          await executeSelect(page, element.selector);
          break;
        case "input":
          await executeInput(page, element.selector);
          break;
        case "scroll":
          await executeScroll(page);
          break;
        case "hover":
          await page.locator(element.selector).first().hover({ timeout: interactionTimeoutMs });
          break;
      }

      await waitForSettle(page, settleTimeMs);

      const afterSnap = await capture.snapshotDataLayer();
      const afterDigital = await capture.snapshotDigitalData();
      const newEvents = capture.getEventsSince(beforeTimestamp);

      const diff = computeEventDiff(beforeSnap, afterSnap, beforeDigital, afterDigital, newEvents);

      const durationMs = Date.now() - start;
      return {
        element,
        success: true,
        durationMs,
        diff,
        newElementsDetected: 0,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
    }
  }

  return {
    element,
    success: false,
    durationMs: Date.now() - start,
    diff: { newEvents: [], missingExpected: [], dataLayerChanges: { added: [], removed: [], modified: [] }, digitalDataChanges: [], networkBeacons: [] },
    error: lastError ?? "Unknown error",
    newElementsDetected: 0,
  };
}
