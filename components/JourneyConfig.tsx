"use client";

import { useState } from "react";
import { JOURNEY_PRESETS } from "@/lib/journey/config";

interface JourneyStep {
  url: string;
  label: string;
  interactionDepth: "full" | "targeted";
  targetActions?: string[];
}

interface Props {
  onStartJourney: (steps: JourneyStep[]) => void;
  disabled: boolean;
}

export function JourneyConfig({ onStartJourney, disabled }: Props) {
  const [steps, setSteps] = useState<JourneyStep[]>([
    { url: "", label: "Page 1", interactionDepth: "full" },
  ]);

  const addStep = () => {
    if (steps.length >= 10) return;
    setSteps([...steps, { url: "", label: `Page ${steps.length + 1}`, interactionDepth: "full" }]);
  };

  const removeStep = (i: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, idx) => idx !== i));
  };

  const updateStep = (i: number, field: keyof JourneyStep, value: string) => {
    const updated = [...steps];
    updated[i] = { ...updated[i], [field]: value };
    setSteps(updated);
  };

  const loadPreset = (presetIdx: number) => {
    const preset = JOURNEY_PRESETS[presetIdx];
    if (preset) setSteps(preset.steps.map((s) => ({ ...s })));
  };

  const validSteps = steps.filter((s) => {
    try { new URL(s.url); return true; } catch { return false; }
  });

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Multi-Page Journey</h4>
        <div className="flex gap-1">
          {JOURNEY_PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => loadPreset(i)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/50 hover:border-white/20 hover:bg-white/[0.08]"
              title={p.description}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-white/8 bg-black/20 p-2.5">
            <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-300">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:border-violet-500/40"
                placeholder="https://example.com/page"
                value={step.url}
                onChange={(e) => updateStep(i, "url", e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  className="w-24 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] text-white outline-none focus:border-violet-500/40"
                  placeholder="Label"
                  value={step.label}
                  onChange={(e) => updateStep(i, "label", e.target.value)}
                />
                <select
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white outline-none"
                  value={step.interactionDepth}
                  onChange={(e) => updateStep(i, "interactionDepth", e.target.value)}
                >
                  <option value="full">Full scan</option>
                  <option value="targeted">Targeted</option>
                </select>
              </div>
            </div>
            {steps.length > 1 && (
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="mt-1 shrink-0 text-xs text-white/25 hover:text-rose-300"
              >
                &#x2715;
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addStep}
          disabled={steps.length >= 10}
          className="text-xs text-cyan-400 hover:underline disabled:opacity-30"
        >
          + Add step
        </button>
        <button
          type="button"
          onClick={() => onStartJourney(validSteps)}
          disabled={disabled || validSteps.length === 0}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
        >
          Run Journey ({validSteps.length} steps)
        </button>
      </div>
    </div>
  );
}
