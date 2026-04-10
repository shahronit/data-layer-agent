"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type TabStripProps<T extends string> = {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
};

export function TabStrip<T extends string>({ tabs, active, onChange }: TabStripProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const list = listRef.current;
    const btn = btnRefs.current[active];
    if (!list || !btn) return;
    const lr = list.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setIndicator({ left: br.left - lr.left + list.scrollLeft, width: br.width });
  }, [active]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(list);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div ref={listRef} className="relative flex shrink-0 gap-0 border-b border-white/10 px-2">
      <span
        className="pointer-events-none absolute bottom-0 h-[3px] rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_16px_rgba(139,92,246,0.45)] transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ left: indicator.left, width: indicator.width }}
        aria-hidden
      />
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            btnRefs.current[t.id] = el;
          }}
          type="button"
          onClick={() => onChange(t.id)}
          className={`relative z-[1] px-4 py-3.5 text-sm font-medium transition-all duration-200 ${
            active === t.id
              ? "text-white scale-[1.02]"
              : "text-white/40 hover:text-white/70 hover:scale-[1.01]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
