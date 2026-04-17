import type { Page } from "playwright";
import type { ElementCategory, InteractionType } from "@/lib/scan-config";

export interface DetectedElement {
  selector: string;
  tag: string;
  role?: string;
  text: string;
  interactionType: InteractionType;
  priority: number;
  category: ElementCategory;
  boundingBox: { x: number; y: number; width: number; height: number };
  visible: boolean;
  attributes: Record<string, string>;
}

interface RawDetected {
  selector: string;
  tag: string;
  role: string | null;
  text: string;
  interactionType: InteractionType;
  priority: number;
  category: ElementCategory;
  bbox: { x: number; y: number; w: number; h: number };
  visible: boolean;
  attrs: Record<string, string>;
}

/**
 * Scan the page for interactive elements, classify them by analytics priority.
 * Runs inside page.evaluate for performance — returns plain data.
 */
export async function detectInteractiveElements(
  page: Page,
  maxElements: number = 120,
): Promise<DetectedElement[]> {
  const raw: RawDetected[] = await page.evaluate((max: number) => {
    const P1_CART = /add.to.cart|add.to.bag|buy.now|purchase|wishlist|add.to.wish/i;
    const P1_CHECKOUT = /check\s?out|proceed|place.order|pay.now|submit.order/i;
    const P1_SIZE_COLOR = /\bsize\b|\bcolor\b|\bcolour\b|\bvariant\b/i;
    const P2_FILTER = /filter|facet|sort.by|refine|narrow/i;
    const P2_PAGINATION = /page|next|prev|load.more|show.more/i;

    type EC =
      | "addToCart" | "wishlist" | "filter" | "pagination" | "productCard"
      | "navigation" | "tab" | "accordion" | "dropdown" | "search"
      | "checkout" | "sizeColor" | "quantity" | "generic";
    type IT = "click" | "select" | "scroll" | "hover" | "input";

    function isVisible(el: Element): boolean {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function uniqueSelector(el: Element): string {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent) return tag;
      const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
      if (siblings.length === 1) {
        const parentSel = uniqueSelector(parent);
        return `${parentSel} > ${tag}`;
      }
      const idx = siblings.indexOf(el) + 1;
      const parentSel = uniqueSelector(parent);
      return `${parentSel} > ${tag}:nth-of-type(${idx})`;
    }

    function classify(el: Element, text: string): { priority: number; category: EC; interactionType: IT } {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role") || "";
      const ariaLabel = el.getAttribute("aria-label") || "";
      const combined = `${text} ${ariaLabel} ${el.className}`;

      if (P1_CART.test(combined)) return { priority: 1, category: "addToCart", interactionType: "click" };
      if (/wishlist|add.to.wish|favorite/i.test(combined)) return { priority: 1, category: "wishlist", interactionType: "click" };
      if (P1_CHECKOUT.test(combined)) return { priority: 1, category: "checkout", interactionType: "click" };
      if (el.closest("[data-product-id], .product-card, .product-tile, .product-item, [class*='product-card']")) {
        return { priority: 1, category: "productCard", interactionType: "click" };
      }
      if (P1_SIZE_COLOR.test(combined) && (tag === "select" || role === "listbox" || tag === "button")) {
        return { priority: 1, category: "sizeColor", interactionType: tag === "select" ? "select" : "click" };
      }
      if (/quantity|qty/i.test(combined)) return { priority: 1, category: "quantity", interactionType: tag === "input" ? "input" : "click" };

      if (tag === "select" || role === "listbox") return { priority: 2, category: "filter", interactionType: "select" };
      if (P2_FILTER.test(combined)) return { priority: 2, category: "filter", interactionType: "click" };
      if (P2_PAGINATION.test(combined) || el.closest(".pagination, [class*='paginat']")) {
        return { priority: 2, category: "pagination", interactionType: "click" };
      }
      if (role === "tab" || el.closest("[role='tablist']")) return { priority: 2, category: "tab", interactionType: "click" };
      if (/accordion|expand|collapse/i.test(combined) || role === "button" && el.getAttribute("aria-expanded") !== null) {
        return { priority: 2, category: "accordion", interactionType: "click" };
      }
      if (role === "menuitem" || role === "option") return { priority: 2, category: "dropdown", interactionType: "click" };
      if (tag === "input" && (el.getAttribute("type") === "search" || /search/i.test(combined))) {
        return { priority: 2, category: "search", interactionType: "input" };
      }
      if (tag === "a" && el.getAttribute("href")) {
        const href = el.getAttribute("href") || "";
        if (href.startsWith("#") || href.startsWith("javascript:")) return { priority: 3, category: "navigation", interactionType: "click" };
        return { priority: 3, category: "navigation", interactionType: "click" };
      }

      return { priority: 3, category: "generic", interactionType: "click" };
    }

    const selector = [
      "a[href]", "button", "[role='button']", "[role='tab']", "[role='menuitem']",
      "[role='link']", "input[type='submit']", "input[type='button']", "select",
      "[data-track]", "[data-product-id]", "[onclick]",
      ".product-card", ".product-tile", ".product-item",
      "input[type='search']", "[role='listbox']",
    ].join(", ");

    const nodes = Array.from(document.querySelectorAll(selector));
    const seen = new Set<string>();
    const results: Array<{
      selector: string; tag: string; role: string | null; text: string;
      interactionType: IT; priority: number; category: EC;
      bbox: { x: number; y: number; w: number; h: number };
      visible: boolean; attrs: Record<string, string>;
    }> = [];

    for (const el of nodes) {
      if (results.length >= max) break;
      if (!isVisible(el)) continue;

      const sel = uniqueSelector(el);
      if (seen.has(sel)) continue;

      const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100);
      const dedup = `${sel}||${text.slice(0, 40)}`;
      if (seen.has(dedup)) continue;
      seen.add(sel);
      seen.add(dedup);

      const { priority, category, interactionType } = classify(el, text);
      const rect = el.getBoundingClientRect();
      const attrs: Record<string, string> = {};
      for (const a of ["data-track", "data-track-id", "data-product-id", "data-event", "aria-label", "href", "type"]) {
        const v = el.getAttribute(a);
        if (v) attrs[a] = v.slice(0, 200);
      }

      results.push({
        selector: sel,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        text,
        interactionType,
        priority,
        category,
        bbox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        visible: true,
        attrs,
      });
    }

    return results;
  }, maxElements);

  return raw.map((r) => ({
    selector: r.selector,
    tag: r.tag,
    role: r.role ?? undefined,
    text: r.text,
    interactionType: r.interactionType,
    priority: r.priority,
    category: r.category,
    boundingBox: { x: r.bbox.x, y: r.bbox.y, width: r.bbox.w, height: r.bbox.h },
    visible: r.visible,
    attributes: r.attrs,
  }));
}
