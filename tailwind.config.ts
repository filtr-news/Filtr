import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1117",
        panel: "#141922",
        steel: "#8392a5",
        signal: "#f0c96a",
        mint: "#65d6ad",
        risk: "#ef6f6c",
        // New landing-page brand tokens (additive — existing report view
        // below the hero continues to use signal/mint/risk above).
        accent: "#32D583",
        accentHover: "#28C76F",
        loadLow: "#22C55E",
        loadMed: "#F59E0B",
        loadHigh: "#EF4444"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 24px 80px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
};

export default config;
