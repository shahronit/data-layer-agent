import type { DetectedElement } from "@/lib/interaction/detector";

export interface CategoryCoverage {
  total: number;
  tested: number;
  pct: number;
}

export interface CoverageReport {
  totalInteractiveElements: number;
  testedElements: number;
  coveragePct: number;
  byCategory: Record<string, CategoryCoverage>;
  untestedElements: Array<{ selector: string; tag: string; text: string; category: string }>;
}

export class CoverageTracker {
  private allElements: DetectedElement[] = [];
  private testedSelectors = new Set<string>();
  private failedSelectors = new Set<string>();

  registerDetected(elements: DetectedElement[]): void {
    for (const el of elements) {
      if (!this.allElements.find((e) => e.selector === el.selector)) {
        this.allElements.push(el);
      }
    }
  }

  markTested(selector: string, success: boolean): void {
    if (success) {
      this.testedSelectors.add(selector);
      this.failedSelectors.delete(selector);
    } else {
      this.failedSelectors.add(selector);
    }
  }

  getReport(): CoverageReport {
    const total = this.allElements.length;
    const tested = this.testedSelectors.size;
    const pct = total > 0 ? Math.round((tested / total) * 100 * 10) / 10 : 0;

    const catMap: Record<string, { total: number; tested: number }> = {};
    for (const el of this.allElements) {
      const cat = el.category;
      if (!catMap[cat]) catMap[cat] = { total: 0, tested: 0 };
      catMap[cat].total++;
      if (this.testedSelectors.has(el.selector)) catMap[cat].tested++;
    }

    const byCategory: Record<string, CategoryCoverage> = {};
    for (const [cat, data] of Object.entries(catMap)) {
      byCategory[cat] = {
        ...data,
        pct: data.total > 0 ? Math.round((data.tested / data.total) * 100 * 10) / 10 : 0,
      };
    }

    const untested = this.allElements
      .filter((el) => !this.testedSelectors.has(el.selector))
      .map((el) => ({ selector: el.selector, tag: el.tag, text: el.text.slice(0, 60), category: el.category }));

    return {
      totalInteractiveElements: total,
      testedElements: tested,
      coveragePct: pct,
      byCategory,
      untestedElements: untested,
    };
  }

  get testedCount(): number {
    return this.testedSelectors.size;
  }

  get totalCount(): number {
    return this.allElements.length;
  }
}
