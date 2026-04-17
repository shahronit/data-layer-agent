export interface ScanOptions {
  url: string;
  waitAfterLoadMs: number;
  navigationTimeoutMs: number;
  maxElements: number;
  interactionTimeoutMs: number;
  settleTimeMs: number;
  enableScreenshots: boolean;
  enableAi: boolean;
  schemas: ("ga4" | "adobe" | "custom")[];
  cookies?: { name: string; value: string; domain?: string; path?: string }[];
  journey?: JourneyStepConfig[];
}

export interface JourneyStepConfig {
  url: string;
  label: string;
  interactionDepth: "full" | "targeted";
  targetActions?: string[];
}

export const DEFAULT_SCAN_OPTIONS: Omit<ScanOptions, "url"> = {
  waitAfterLoadMs: 3000,
  navigationTimeoutMs: 45_000,
  maxElements: 120,
  interactionTimeoutMs: 5000,
  settleTimeMs: 3000,
  enableScreenshots: true,
  enableAi: false,
  schemas: ["ga4", "adobe"],
};

export type ElementCategory =
  | "addToCart"
  | "wishlist"
  | "filter"
  | "pagination"
  | "productCard"
  | "navigation"
  | "tab"
  | "accordion"
  | "dropdown"
  | "search"
  | "checkout"
  | "sizeColor"
  | "quantity"
  | "generic";

export type InteractionType = "click" | "select" | "scroll" | "hover" | "input";

export interface ScanProgressEvent {
  type: "phase" | "interaction" | "detection" | "validation" | "coverage" | "error" | "complete";
  scanId: string;
  message: string;
  data?: Record<string, unknown>;
}
