import fs from "fs";
import path from "path";
import type { EventSchema } from "../validator";

const CUSTOM_SCHEMAS_PATH = path.join(process.cwd(), "data", "custom-schemas.json");

interface CustomSchemaFile {
  schemas: Array<{
    name: string;
    eventNamePattern: string;
    platform?: string;
    fields: Array<{
      path: string;
      required: boolean;
      type: string;
      description?: string;
    }>;
  }>;
}

export function loadCustomSchemas(): EventSchema[] {
  try {
    if (!fs.existsSync(CUSTOM_SCHEMAS_PATH)) return [];
    const raw = fs.readFileSync(CUSTOM_SCHEMAS_PATH, "utf-8");
    const parsed: CustomSchemaFile = JSON.parse(raw);
    if (!Array.isArray(parsed.schemas)) return [];

    return parsed.schemas.map((s) => ({
      name: s.name,
      eventNamePattern: new RegExp(s.eventNamePattern, "i"),
      platform: (s.platform as "ga4" | "adobe" | "custom") || "custom",
      fields: s.fields.map((f) => ({
        path: f.path,
        required: f.required,
        type: f.type as "string" | "number" | "boolean" | "object" | "array",
        description: f.description,
      })),
    }));
  } catch {
    return [];
  }
}
