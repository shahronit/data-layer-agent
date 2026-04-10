"use client";

export function EmptyStateHero() {
  return (
    <div className="tl-fade-up relative mx-auto max-w-lg px-6 py-16 text-center">
      <div className="relative mx-auto mb-8 h-40 w-full max-w-xs">
        <div className="absolute inset-0 rounded-3xl border border-dashed border-violet-500/30 bg-gradient-to-b from-violet-500/[0.08] to-cyan-500/[0.04] shadow-[0_0_60px_-12px_rgba(139,92,246,0.35)]" />
        <svg
          viewBox="0 0 200 120"
          className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] text-cyan-400/50"
          aria-hidden
        >
          <defs>
            <linearGradient id="scanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <rect
            x="12"
            y="16"
            width="176"
            height="88"
            rx="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            className="tl-stroke-glow"
          />
          <line x1="12" y1="36" x2="188" y2="36" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          <circle cx="26" cy="26" r="3" fill="#a78bfa" className="tl-dot-pulse" />
          <circle cx="38" cy="26" r="3" fill="#22d3ee" opacity="0.7" />
          <circle cx="50" cy="26" r="3" fill="#c4b5fd" opacity="0.4" />
          <g className="text-violet-400/40">
            <rect x="28" y="48" width="64" height="8" rx="2" fill="currentColor" className="tl-bar-shimmer" />
            <rect x="28" y="62" width="48" height="8" rx="2" fill="currentColor" className="tl-bar-shimmer tl-bar-delay" />
            <rect x="28" y="76" width="88" height="8" rx="2" fill="currentColor" className="tl-bar-shimmer tl-bar-delay-2" />
          </g>
          <line
            x1="20"
            y1="56"
            x2="180"
            y2="56"
            stroke="url(#scanGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
            className="tl-scan-sweep"
          />
        </svg>
      </div>
      <h2 className="font-display text-xl font-bold tracking-tight text-white">Start with a page URL</h2>
      <p className="mt-3 text-sm leading-relaxed text-white/50">
        Run a check to see open findings in order (P1 first), plain fixes, file downloads, and optional Jira tickets for
        your test cycle.
      </p>
    </div>
  );
}
