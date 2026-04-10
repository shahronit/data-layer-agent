import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        exp: {
          void: "#0d1117",
          surface: "#161b22",
          elevated: "#1c2128",
          border: "#30363d",
          muted: "#8b949e",
          text: "#e6edf3",
          accent: "#1473e6",
          "accent-hover": "#0d66d0",
          success: "#2ebc4f",
          warning: "#f5a623",
          danger: "#e34850",
          glow: "#5c9dff",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(13,17,23,0.2), rgba(13,17,23,1)), radial-gradient(ellipse 80% 50% at 50% -20%, rgba(20,115,230,0.25), transparent)",
        "card-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)",
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(48,54,61,0.6), 0 24px 48px -12px rgba(0,0,0,0.45)",
        glow: "0 0 40px -8px rgba(20,115,230,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
