import type { Page } from "playwright";
import type { CapturedEvent, CapturedEventSource } from "@/lib/types";

export type DataLayerSnapshot = unknown[];
export type DigitalDataSnapshot = Record<string, unknown> | null;

const MAX_STREAM_EVENTS = 500;

/**
 * Reusable event capture session attached to a Playwright page.
 * Patches dataLayer.push, polls digitalData, hooks _satellite.track,
 * and captures network beacons — all via page.exposeFunction + addInitScript.
 */
export class EventCaptureSession {
  private events: CapturedEvent[] = [];
  private sessionStartMs: number;
  private page: Page;
  private installed = false;

  constructor(page: Page) {
    this.page = page;
    this.sessionStartMs = Date.now();
  }

  async install(): Promise<void> {
    if (this.installed) return;
    this.installed = true;
    const events = this.events;
    const startMs = this.sessionStartMs;

    await this.page.exposeFunction(
      "__llCapturePush",
      (source: string, eventName: string, payload: unknown, pageUrl: string) => {
        if (events.length >= MAX_STREAM_EVENTS) return;
        events.push({
          timestamp: Date.now() - startMs,
          source: source as CapturedEventSource,
          eventName,
          payload,
          pageUrl,
        });
      },
    );

    await this.page.addInitScript(() => {
      const w = window as Window & {
        __llCapturePush?: (s: string, n: string, p: unknown, u: string) => void;
        __llDlPushPatched?: boolean;
        __llSatTrackPatched?: boolean;
        __llTrackEvents?: string[];
      };
      w.__llTrackEvents = [];

      function push(source: string, eventName: string, payload: unknown) {
        if (!w.__llCapturePush) return;
        try {
          const serialized = JSON.parse(JSON.stringify(payload));
          w.__llCapturePush(source, eventName, serialized, window.location.href);
        } catch {
          w.__llCapturePush(source, eventName, { _note: "not serializable" }, window.location.href);
        }
      }

      let ddLastSnap = "";

      const patchAll = () => {
        try {
          const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
          if (dl && Array.isArray(dl) && !w.__llDlPushPatched) {
            w.__llDlPushPatched = true;
            for (const entry of dl) {
              const evName =
                entry && typeof entry === "object" && "event" in (entry as Record<string, unknown>)
                  ? String((entry as Record<string, unknown>).event)
                  : "dataLayer.push";
              push("dataLayer", evName, entry);
            }
            const origPush = dl.push.bind(dl);
            dl.push = function (...args: unknown[]) {
              for (const arg of args) {
                const evName =
                  arg && typeof arg === "object" && "event" in (arg as Record<string, unknown>)
                    ? String((arg as Record<string, unknown>).event)
                    : "dataLayer.push";
                push("dataLayer", evName, arg);
              }
              return origPush(...args);
            };
          }
        } catch { /* ignore */ }

        try {
          const dd = (window as unknown as { digitalData?: Record<string, unknown> }).digitalData;
          if (dd && typeof dd === "object") {
            const snap = JSON.stringify(dd);
            if (!ddLastSnap) {
              ddLastSnap = snap;
              for (const key of Object.keys(dd)) push("digitalData", `digitalData.${key}`, dd[key]);
            } else if (snap !== ddLastSnap) {
              const prev = JSON.parse(ddLastSnap) as Record<string, unknown>;
              for (const key of Object.keys(dd)) {
                if (JSON.stringify(dd[key]) !== JSON.stringify(prev[key])) {
                  push("digitalData", `digitalData.${key}`, dd[key]);
                }
              }
              ddLastSnap = snap;
            }
          }
        } catch { /* ignore */ }

        try {
          const sat = (window as unknown as { _satellite?: { track?: (n: unknown, ...a: unknown[]) => unknown } })._satellite;
          if (sat && typeof sat.track === "function" && !w.__llSatTrackPatched) {
            w.__llSatTrackPatched = true;
            const orig = sat.track.bind(sat);
            sat.track = (name: unknown, ...rest: unknown[]) => {
              const n = String(name);
              const arr = w.__llTrackEvents!;
              if (arr.length < 100) arr.push(n);
              push("satellite", n, { trackName: n, args: rest.length ? rest : undefined });
              return orig(name, ...rest);
            };
          }
        } catch { /* ignore */ }
      };

      patchAll();
      const iv = window.setInterval(patchAll, 300);
      window.setTimeout(() => window.clearInterval(iv), 10 * 60 * 1000);
    });
  }

  async snapshotDataLayer(): Promise<DataLayerSnapshot> {
    try {
      return await this.page.evaluate(() => {
        const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
        if (!Array.isArray(dl)) return [];
        return JSON.parse(JSON.stringify(dl));
      });
    } catch {
      return [];
    }
  }

  async snapshotDigitalData(): Promise<DigitalDataSnapshot> {
    try {
      return await this.page.evaluate(() => {
        const dd = (window as unknown as { digitalData?: Record<string, unknown> }).digitalData;
        if (!dd || typeof dd !== "object") return null;
        return JSON.parse(JSON.stringify(dd));
      });
    } catch {
      return null;
    }
  }

  getEventsSince(timestampMs: number): CapturedEvent[] {
    const sinceRelative = timestampMs - this.sessionStartMs;
    return this.events.filter((e) => e.timestamp >= sinceRelative);
  }

  getAllEvents(): CapturedEvent[] {
    return [...this.events];
  }

  get eventCount(): number {
    return this.events.length;
  }

  reset(): void {
    this.events = [];
    this.sessionStartMs = Date.now();
  }
}
