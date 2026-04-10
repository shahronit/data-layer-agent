"use client";

import { APP_NAME } from "@/lib/brand";

/**
 * LayerLens mark: lens + stacked layers (data layer metaphor) + prism rim.
 * Designed to read clearly at 16–48px and as favicon.
 */
export function BrandMark({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const box = compact ? "h-9 w-9" : "h-12 w-12";
  const svg = compact ? "h-6 w-6" : "h-[2.125rem] w-[2.125rem]";
  return (
    <div
      className={`relative flex ${box} shrink-0 items-center justify-center ${className}`}
      role="img"
      aria-label={APP_NAME}
    >
      <div className="tl-logo-ring absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 p-[2px] shadow-lg shadow-violet-500/35">
        <div className={`flex h-full w-full items-center justify-center ${compact ? "rounded-[10px]" : "rounded-[14px]"} bg-[#07070f]`}>
          <svg viewBox="0 0 48 48" className={svg} aria-hidden>
            <defs>
              <linearGradient id="ll-rim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="45%" stopColor="#e879f9" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
              <linearGradient id="ll-glass" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(34, 211, 238, 0.14)" />
                <stop offset="100%" stopColor="rgba(167, 139, 250, 0.1)" />
              </linearGradient>
              <linearGradient id="ll-beam" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="rgba(34, 211, 238, 0.35)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            {/* Outer lens ellipse */}
            <ellipse
              cx="24"
              cy="24"
              rx="17"
              ry="13.5"
              fill="none"
              stroke="url(#ll-rim)"
              strokeWidth="2.25"
              className="tl-stroke-glow"
            />
            {/* Inner glass */}
            <ellipse cx="24" cy="24" rx="13.5" ry="10.5" fill="url(#ll-glass)" />
            {/* Data “layers” — three bars, focal clarity in the middle */}
            <line
              x1="13"
              y1="19.5"
              x2="35"
              y2="19.5"
              stroke="#a78bfa"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.95}
            />
            <line
              x1="14.5"
              y1="24"
              x2="33.5"
              y2="24"
              stroke="#22d3ee"
              strokeWidth="2.25"
              strokeLinecap="round"
              className="tl-bar-shimmer"
            />
            <line
              x1="16"
              y1="28.5"
              x2="32"
              y2="28.5"
              stroke="#c4b5fd"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.65}
            />
            {/* Subtle focus flare */}
            <ellipse cx="30" cy="18" rx="5" ry="3" fill="url(#ll-beam)" opacity={0.85} className="tl-lens-flare" />
            {/* Center focal point */}
            <circle cx="24" cy="24" r="2" fill="#22d3ee" className="tl-dot-pulse" opacity={0.75} />
          </svg>
        </div>
      </div>
    </div>
  );
}
