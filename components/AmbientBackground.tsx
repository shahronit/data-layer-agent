"use client";

/**
 * Full-viewport decorative layer: gradient mesh, grid, orbs, scan line.
 * pointer-events: none — does not block interaction.
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Slow-rotating color wash */}
      <div className="tl-mesh absolute -left-1/2 -top-1/2 h-[200%] w-[200%] opacity-70" />

      {/* Floating orbs */}
      <div className="tl-orb tl-orb-a absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-violet-600/25 blur-[100px]" />
      <div className="tl-orb tl-orb-b absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-cyan-500/20 blur-[90px]" />
      <div className="tl-orb tl-orb-c absolute left-1/3 top-[60%] h-64 w-64 rounded-full bg-fuchsia-600/15 blur-[80px]" />

      {/* Technical grid + corner accents */}
      <svg className="tl-grid absolute inset-0 h-full w-full text-white/[0.04]" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="tl-hex" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
            <path
              d="M28 0 L56 16.5 L56 50 L28 66.5 L0 50 L0 16.5 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
            <path
              d="M28 33.5 L56 50 L56 83.5 L28 100 L0 83.5 L0 50 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
          <linearGradient id="tl-vignette" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06060a" stopOpacity="0.2" />
            <stop offset="45%" stopColor="#06060a" stopOpacity="0" />
            <stop offset="100%" stopColor="#06060a" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#tl-hex)" />
        <rect width="100%" height="100%" fill="url(#tl-vignette)" />
          {/* Animated signal arcs */}
        <g className="tl-trace-stroke text-violet-400/30" fill="none" stroke="currentColor" strokeWidth="1">
          <path className="tl-dash-animate" d="M 0 120 Q 200 80 400 140 T 800 100" />
          <path className="tl-dash-animate tl-dash-delay" d="M 0 280 Q 240 220 520 300 T 1000 240" />
        </g>
      </svg>

      {/* Horizontal scan shimmer */}
      <div className="tl-scanline pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      {/* Bottom glow strip */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
    </div>
  );
}
