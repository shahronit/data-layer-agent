import { getGeminiApiKey } from "@/lib/gemini-env";

interface AnomalyInput {
  scanId: string;
  url: string;
  interactions: Array<{
    element: string;
    category: string;
    events: Array<{ name: string; source: string; payload: unknown }>;
    diffSummary: string;
  }>;
  validationFailures: Array<{
    schemaName: string;
    eventName: string;
    errors: Array<{ field: string; message: string }>;
  }>;
  coverageGaps: Array<{ category: string; untested: number; total: number }>;
  pageLoadEvents: Array<{ name: string; source: string }>;
}

export interface DetectedAnomaly {
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  suggestedFix: string;
  relatedInteractions?: string[];
}

export interface AnomalyReport {
  anomalies: DetectedAnomaly[];
  summary: string;
  generatedAt: string;
}

const SYSTEM_PROMPT = `You are an expert web analytics QA engineer. Analyze the interaction scan results and identify anomalies in the analytics data layer implementation.

Focus on:
1. Duplicate events: same event firing multiple times for one interaction
2. Missing events: interactions that should trigger analytics events but didn't
3. Incorrect payloads: missing required fields, wrong data types, inconsistent naming
4. Naming convention issues: mixed casing (snake_case vs camelCase), inconsistent event names
5. Coverage gaps: categories of elements with zero analytics coverage
6. Data consistency: prices/quantities/IDs that don't match across related events

Respond ONLY with valid JSON matching this schema:
{
  "anomalies": [
    {
      "severity": "critical|warning|info",
      "category": "duplicate|missing|payload|naming|coverage|consistency",
      "title": "Short title",
      "description": "Detailed description",
      "suggestedFix": "How to fix this",
      "relatedInteractions": ["element descriptions"]
    }
  ],
  "summary": "One paragraph overall assessment"
}`;

export async function detectAnomalies(input: AnomalyInput): Promise<AnomalyReport> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      anomalies: [],
      summary: "AI anomaly detection is not configured. Set GEMINI_API_KEY to enable.",
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const userContent = `Analyze this interaction scan for analytics anomalies:

URL: ${input.url}
Total interactions: ${input.interactions.length}
Validation failures: ${input.validationFailures.length}

Page load events:
${JSON.stringify(input.pageLoadEvents.slice(0, 20), null, 2)}

Interaction results (sample):
${JSON.stringify(input.interactions.slice(0, 30), null, 2)}

Validation failures:
${JSON.stringify(input.validationFailures.slice(0, 20), null, 2)}

Coverage gaps:
${JSON.stringify(input.coverageGaps, null, 2)}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userContent }] }],
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { anomalies: [], summary: "AI returned no structured output.", generatedAt: new Date().toISOString() };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { anomalies?: DetectedAnomaly[]; summary?: string };
    return {
      anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
      summary: parsed.summary || "Analysis complete.",
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      anomalies: [],
      summary: `AI analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      generatedAt: new Date().toISOString(),
    };
  }
}
