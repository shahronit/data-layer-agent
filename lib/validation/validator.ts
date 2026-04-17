import type { CapturedEvent } from "@/lib/types";
import { GA4_SCHEMAS } from "./schemas/ga4";
import { ADOBE_SCHEMAS } from "./schemas/adobe";
import { loadCustomSchemas } from "./schemas/custom";

export interface FieldSpec {
  path: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
}

export interface EventSchema {
  name: string;
  eventNamePattern: RegExp;
  platform: "ga4" | "adobe" | "custom";
  fields: FieldSpec[];
  customValidation?: (payload: Record<string, unknown>) => ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: "fail" | "warn";
}

export interface ValidationResult {
  schemaName: string;
  platform: string;
  eventName: string;
  status: "pass" | "fail" | "warn";
  errors: ValidationError[];
}

export class SchemaRegistry {
  private schemas: EventSchema[] = [];

  constructor(enabledPlatforms: ("ga4" | "adobe" | "custom")[] = ["ga4", "adobe"]) {
    if (enabledPlatforms.includes("ga4")) this.schemas.push(...GA4_SCHEMAS);
    if (enabledPlatforms.includes("adobe")) this.schemas.push(...ADOBE_SCHEMAS);
    if (enabledPlatforms.includes("custom")) this.schemas.push(...loadCustomSchemas());
  }

  findSchema(eventName: string): EventSchema | null {
    return this.schemas.find((s) => s.eventNamePattern.test(eventName)) ?? null;
  }

  get allSchemas(): EventSchema[] {
    return [...this.schemas];
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (path.includes("[]")) {
    const [arrayPath, ...rest] = path.split("[].");
    const arr = getNestedValue(obj, arrayPath);
    if (!Array.isArray(arr)) return undefined;
    if (rest.length === 0) return arr;
    return arr.map((item) => getNestedValue(item, rest.join("[].")));
  }

  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function checkType(value: unknown, expectedType: string): boolean {
  if (value === undefined || value === null) return false;
  switch (expectedType) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number";
    case "boolean": return typeof value === "boolean";
    case "object": return typeof value === "object" && !Array.isArray(value);
    case "array": return Array.isArray(value);
    default: return true;
  }
}

export function validateEvent(
  event: CapturedEvent,
  registry: SchemaRegistry,
): ValidationResult | null {
  const schema = registry.findSchema(event.eventName);
  if (!schema) return null;

  const errors: ValidationError[] = [];
  const payload = (event.payload && typeof event.payload === "object" ? event.payload : {}) as Record<string, unknown>;

  for (const field of schema.fields) {
    if (field.path.includes("[].")) {
      const arrayPath = field.path.split("[].")[0];
      const itemPath = field.path.split("[].").slice(1).join("[].");
      const arr = getNestedValue(payload, arrayPath);

      if (field.required && !Array.isArray(arr)) {
        errors.push({ field: arrayPath, message: `Required array '${arrayPath}' is missing`, severity: "fail" });
        continue;
      }
      if (Array.isArray(arr) && arr.length > 0 && itemPath) {
        const firstItem = arr[0];
        const val = getNestedValue(firstItem, itemPath);
        if (field.required && (val === undefined || val === null)) {
          errors.push({ field: field.path, message: `Required field '${itemPath}' missing in first item of ${arrayPath}`, severity: "fail" });
        } else if (val !== undefined && val !== null && !checkType(val, field.type)) {
          errors.push({ field: field.path, message: `Expected type '${field.type}' but got '${typeof val}'`, severity: "warn" });
        }
      }
    } else {
      const val = getNestedValue(payload, field.path);
      if (field.required && (val === undefined || val === null || val === "")) {
        errors.push({ field: field.path, message: `Required field '${field.path}' is missing`, severity: "fail" });
      } else if (val !== undefined && val !== null && !checkType(val, field.type)) {
        errors.push({ field: field.path, message: `Expected type '${field.type}' but got '${typeof val}'`, severity: "warn" });
      }
    }
  }

  if (schema.customValidation) {
    errors.push(...schema.customValidation(payload));
  }

  const hasFail = errors.some((e) => e.severity === "fail");
  const hasWarn = errors.some((e) => e.severity === "warn");

  return {
    schemaName: schema.name,
    platform: schema.platform,
    eventName: event.eventName,
    status: hasFail ? "fail" : hasWarn ? "warn" : "pass",
    errors,
  };
}

export function validateEvents(
  events: CapturedEvent[],
  registry: SchemaRegistry,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const event of events) {
    const result = validateEvent(event, registry);
    if (result) results.push(result);
  }
  return results;
}
