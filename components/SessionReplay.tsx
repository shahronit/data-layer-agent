"use client";

import { useState } from "react";

interface ReplayStep {
  index: number;
  element: { selector: string; tag: string; text: string; category: string };
  interactionType: string;
  durationMs: number;
  error: string | null;
  diff: unknown;
  events: Array<{ source: string; event_name: string; payload: unknown }>;
  screenshots: string[];
}

interface PageLoadData {
  events: Array<{ source: string; event_name: string; payload: unknown }>;
  screenshots: string[];
}

interface Props {
  steps: ReplayStep[];
  pageLoad: PageLoadData;
  scanId: string;
}

export function SessionReplay({ steps, pageLoad, scanId }: Props) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = page load

  const total = steps.length;
  const activeStep = currentStep === -1 ? null : steps[currentStep];
  const activeEvents = currentStep === -1 ? pageLoad.events : activeStep?.events || [];
  const activeScreenshots = currentStep === -1 ? pageLoad.screenshots : activeStep?.screenshots || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">Session Replay</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep(Math.max(-1, currentStep - 1))}
            disabled={currentStep <= -1}
            className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.1] disabled:opacity-30"
          >
            Previous
          </button>
          <span className="min-w-[4rem] text-center text-xs text-white/40">
            {currentStep === -1 ? "Page Load" : `${currentStep + 1} / ${total}`}
          </span>
          <button
            type="button"
            onClick={() => setCurrentStep(Math.min(total - 1, currentStep + 1))}
            disabled={currentStep >= total - 1}
            className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.1] disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>

      {/* Step timeline bar */}
      <div className="flex gap-0.5">
        <button
          type="button"
          onClick={() => setCurrentStep(-1)}
          className={`h-2 flex-1 rounded-full transition ${currentStep === -1 ? "bg-violet-400" : "bg-white/10 hover:bg-white/20"}`}
          title="Page Load"
        />
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentStep(i)}
            className={`h-2 flex-1 rounded-full transition ${
              i === currentStep
                ? "bg-violet-400"
                : s.error
                  ? "bg-rose-400/40 hover:bg-rose-400/60"
                  : i < currentStep
                    ? "bg-emerald-400/40"
                    : "bg-white/10 hover:bg-white/20"
            }`}
            title={`#${i + 1} ${s.element.tag} — ${s.element.text.slice(0, 30)}`}
          />
        ))}
      </div>

      {/* Active step details */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        {currentStep === -1 ? (
          <div>
            <h4 className="text-sm font-bold text-white/70">Page Load</h4>
            <p className="mt-1 text-xs text-white/40">Initial page state and events captured on load.</p>
          </div>
        ) : activeStep ? (
          <div>
            <h4 className="text-sm font-bold text-white/70">
              #{activeStep.index + 1}: {activeStep.interactionType} &lt;{activeStep.element.tag}&gt;
            </h4>
            <p className="mt-1 text-xs text-white/40">{activeStep.element.text || "(no text)"}</p>
            <div className="mt-1 flex gap-2 text-[10px]">
              <span className="text-white/30">{activeStep.durationMs}ms</span>
              <span className="capitalize text-white/30">{activeStep.element.category}</span>
            </div>
            {activeStep.error && (
              <p className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">{activeStep.error}</p>
            )}
          </div>
        ) : null}

        {activeScreenshots.length > 0 && (
          <img
            src={`/api/scan/${scanId}/screenshots/${activeScreenshots[0].split("/").pop()}`}
            alt="Step screenshot"
            className="rounded-lg border border-white/10 max-h-56 object-contain"
          />
        )}

        {activeEvents.length > 0 && (
          <div>
            <h5 className="mb-1.5 text-xs font-bold text-white/50">Events ({activeEvents.length})</h5>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {activeEvents.map((ev, i) => (
                <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-[10px]">
                  <span className="font-medium text-cyan-200/70">{ev.source}</span>
                  <span className="mx-1 text-white/20">/</span>
                  <span className="text-white/60">{ev.event_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
