import type { JourneyStepConfig } from "@/lib/scan-config";

export const ECOMMERCE_JOURNEY: JourneyStepConfig[] = [
  { url: "", label: "Home", interactionDepth: "targeted", targetActions: ["navigation", "search"] },
  { url: "", label: "PLP", interactionDepth: "targeted", targetActions: ["productCard", "filter", "pagination"] },
  { url: "", label: "PDP", interactionDepth: "full" },
  { url: "", label: "Cart", interactionDepth: "targeted", targetActions: ["addToCart", "quantity", "checkout"] },
  { url: "", label: "Checkout", interactionDepth: "targeted", targetActions: ["checkout"] },
];

export const CONTENT_SITE_JOURNEY: JourneyStepConfig[] = [
  { url: "", label: "Home", interactionDepth: "full" },
  { url: "", label: "Category", interactionDepth: "targeted", targetActions: ["navigation", "filter"] },
  { url: "", label: "Article", interactionDepth: "full" },
];

export interface JourneyPreset {
  name: string;
  description: string;
  steps: JourneyStepConfig[];
}

export const JOURNEY_PRESETS: JourneyPreset[] = [
  {
    name: "Ecommerce Flow",
    description: "Home → Product List → Product Detail → Cart → Checkout",
    steps: ECOMMERCE_JOURNEY,
  },
  {
    name: "Content Site",
    description: "Home → Category → Article/Content page",
    steps: CONTENT_SITE_JOURNEY,
  },
];
