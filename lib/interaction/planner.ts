import type { DetectedElement } from "./detector";

export interface InteractionPlan {
  ordered: DetectedElement[];
  totalDetected: number;
  skippedDuplicates: number;
}

/**
 * Order detected elements for optimal interaction coverage:
 * 1. Sort by priority (P1 first), then by vertical position on page
 * 2. Deduplicate by selector hash
 * 3. Cap at maxElements
 */
export function buildInteractionPlan(
  elements: DetectedElement[],
  maxElements: number = 120,
): InteractionPlan {
  const seen = new Set<string>();
  const deduped: DetectedElement[] = [];
  let skipped = 0;

  for (const el of elements) {
    const hash = `${el.selector}||${el.text.slice(0, 30)}`;
    if (seen.has(hash)) {
      skipped++;
      continue;
    }
    seen.add(hash);
    deduped.push(el);
  }

  deduped.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.boundingBox.y - b.boundingBox.y;
  });

  const ordered = deduped.slice(0, maxElements);

  return {
    ordered,
    totalDetected: elements.length,
    skippedDuplicates: skipped,
  };
}

/**
 * After an interaction, check if a modal/overlay appeared.
 * Returns true if a new overlay is detected.
 */
export async function detectModalOpened(
  page: import("playwright").Page,
): Promise<boolean> {
  return page.evaluate(() => {
    const modals = document.querySelectorAll(
      "[role='dialog'], [role='alertdialog'], .modal, .overlay, [class*='modal'], [class*='dialog'], [class*='popup']",
    );
    for (const m of modals) {
      const style = window.getComputedStyle(m);
      if (style.display !== "none" && style.visibility !== "hidden") {
        const rect = m.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 100) return true;
      }
    }
    return false;
  });
}

/**
 * Attempt to close any open modal/overlay.
 */
export async function closeModal(page: import("playwright").Page): Promise<void> {
  try {
    const closed = await page.evaluate(() => {
      const closeButtons = document.querySelectorAll(
        "[aria-label*='close' i], [aria-label*='dismiss' i], .modal-close, .close-btn, [class*='close'], button[class*='dismiss']",
      );
      for (const btn of closeButtons) {
        const style = window.getComputedStyle(btn);
        if (style.display !== "none" && style.visibility !== "hidden") {
          (btn as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    if (closed) {
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch {
    /* best effort */
  }
}

/**
 * Check if the current page has pagination and return selectors for next pages.
 */
export async function detectPagination(
  page: import("playwright").Page,
): Promise<string[]> {
  return page.evaluate(() => {
    const paginationLinks: string[] = [];
    const candidates = document.querySelectorAll(
      ".pagination a, [class*='paginat'] a, [aria-label*='page' i], nav[aria-label*='paginat' i] a",
    );
    for (const c of candidates) {
      const style = window.getComputedStyle(c);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const text = (c.textContent || "").trim();
      if (/^\d+$/.test(text) && text !== "1") {
        if (c.id) paginationLinks.push(`#${c.id}`);
      }
    }
    return paginationLinks.slice(0, 3);
  });
}
