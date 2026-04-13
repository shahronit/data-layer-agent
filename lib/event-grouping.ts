import type { CapturedEvent, CapturedEventSource } from "./types";

export interface EventGroupSource {
  source: CapturedEventSource;
  count: number;
  events: CapturedEvent[];
}

export interface EventGroup {
  eventName: string;
  occurrences: number;
  sources: EventGroupSource[];
  firstSeen: number;
  lastSeen: number;
}

export interface EventStreamSummary {
  totalEvents: number;
  uniqueNames: number;
  captureDurationMs: number;
  bySource: Record<CapturedEventSource, number>;
  groups: EventGroup[];
}

/**
 * Group a flat event stream by event name, then break each group
 * down by source. Groups are sorted by first-seen timestamp.
 */
export function groupEventsByName(events: CapturedEvent[]): EventGroup[] {
  const map = new Map<string, CapturedEvent[]>();

  for (const ev of events) {
    const list = map.get(ev.eventName);
    if (list) {
      list.push(ev);
    } else {
      map.set(ev.eventName, [ev]);
    }
  }

  const groups: EventGroup[] = [];

  for (const [eventName, evts] of map) {
    const sourceMap = new Map<CapturedEventSource, CapturedEvent[]>();
    for (const ev of evts) {
      const list = sourceMap.get(ev.source);
      if (list) list.push(ev);
      else sourceMap.set(ev.source, [ev]);
    }

    const sources: EventGroupSource[] = [];
    for (const [source, sourceEvts] of sourceMap) {
      sources.push({
        source,
        count: sourceEvts.length,
        events: sourceEvts.sort((a, b) => a.timestamp - b.timestamp),
      });
    }
    sources.sort((a, b) => a.events[0].timestamp - b.events[0].timestamp);

    const timestamps = evts.map((e) => e.timestamp);
    groups.push({
      eventName,
      occurrences: evts.length,
      sources,
      firstSeen: Math.min(...timestamps),
      lastSeen: Math.max(...timestamps),
    });
  }

  groups.sort((a, b) => a.firstSeen - b.firstSeen);
  return groups;
}

/** Build a full summary from an event stream. */
export function buildEventStreamSummary(events: CapturedEvent[]): EventStreamSummary {
  const bySource: Record<CapturedEventSource, number> = {
    dataLayer: 0,
    digitalData: 0,
    satellite: 0,
    network: 0,
  };

  for (const ev of events) {
    bySource[ev.source] = (bySource[ev.source] ?? 0) + 1;
  }

  const groups = groupEventsByName(events);
  const timestamps = events.map((e) => e.timestamp);
  const captureDurationMs =
    timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;

  return {
    totalEvents: events.length,
    uniqueNames: groups.length,
    captureDurationMs,
    bySource,
    groups,
  };
}
