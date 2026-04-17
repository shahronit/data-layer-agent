import type { CapturedEvent } from "@/lib/types";
import type { DataLayerSnapshot, DigitalDataSnapshot } from "./event-capture";

export interface DataLayerEntry {
  index: number;
  event?: string;
  payload: unknown;
}

export interface DigitalDataChange {
  path: string;
  before: unknown;
  after: unknown;
}

export interface EventDiff {
  newEvents: CapturedEvent[];
  missingExpected: string[];
  dataLayerChanges: {
    added: DataLayerEntry[];
    removed: DataLayerEntry[];
    modified: { before: DataLayerEntry; after: DataLayerEntry }[];
  };
  digitalDataChanges: DigitalDataChange[];
  networkBeacons: CapturedEvent[];
}

function getEventName(entry: unknown): string | undefined {
  if (entry && typeof entry === "object" && "event" in (entry as Record<string, unknown>)) {
    return String((entry as Record<string, unknown>).event);
  }
  return undefined;
}

function toEntry(index: number, payload: unknown): DataLayerEntry {
  return { index, event: getEventName(payload), payload };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  const aStr = JSON.stringify(a);
  const bStr = JSON.stringify(b);
  return aStr === bStr;
}

function diffDigitalData(
  before: DigitalDataSnapshot,
  after: DigitalDataSnapshot,
  prefix: string = "",
): DigitalDataChange[] {
  const changes: DigitalDataChange[] = [];
  if (!before && !after) return changes;
  if (!before && after) {
    for (const key of Object.keys(after)) {
      changes.push({ path: prefix ? `${prefix}.${key}` : key, before: undefined, after: after[key] });
    }
    return changes;
  }
  if (before && !after) {
    for (const key of Object.keys(before)) {
      changes.push({ path: prefix ? `${prefix}.${key}` : key, before: before[key], after: undefined });
    }
    return changes;
  }

  const allKeys = new Set([...Object.keys(before!), ...Object.keys(after!)]);
  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const bVal = (before as Record<string, unknown>)[key];
    const aVal = (after as Record<string, unknown>)[key];

    if (bVal === undefined && aVal !== undefined) {
      changes.push({ path, before: undefined, after: aVal });
    } else if (bVal !== undefined && aVal === undefined) {
      changes.push({ path, before: bVal, after: undefined });
    } else if (!deepEqual(bVal, aVal)) {
      if (bVal && aVal && typeof bVal === "object" && typeof aVal === "object" && !Array.isArray(bVal) && !Array.isArray(aVal)) {
        changes.push(...diffDigitalData(bVal as Record<string, unknown>, aVal as Record<string, unknown>, path));
      } else {
        changes.push({ path, before: bVal, after: aVal });
      }
    }
  }
  return changes;
}

export function computeEventDiff(
  dlBefore: DataLayerSnapshot,
  dlAfter: DataLayerSnapshot,
  ddBefore: DigitalDataSnapshot,
  ddAfter: DigitalDataSnapshot,
  newEvents: CapturedEvent[],
): EventDiff {
  const added: DataLayerEntry[] = [];
  const removed: DataLayerEntry[] = [];
  const modified: { before: DataLayerEntry; after: DataLayerEntry }[] = [];

  const minLen = Math.min(dlBefore.length, dlAfter.length);
  for (let i = 0; i < minLen; i++) {
    if (!deepEqual(dlBefore[i], dlAfter[i])) {
      modified.push({ before: toEntry(i, dlBefore[i]), after: toEntry(i, dlAfter[i]) });
    }
  }
  for (let i = minLen; i < dlAfter.length; i++) {
    added.push(toEntry(i, dlAfter[i]));
  }
  for (let i = minLen; i < dlBefore.length; i++) {
    removed.push(toEntry(i, dlBefore[i]));
  }

  const digitalDataChanges = diffDigitalData(ddBefore, ddAfter);
  const networkBeacons = newEvents.filter((e) => e.source === "network");

  return {
    newEvents,
    missingExpected: [],
    dataLayerChanges: { added, removed, modified },
    digitalDataChanges,
    networkBeacons,
  };
}
