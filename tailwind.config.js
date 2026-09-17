/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="pure-black"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "rgb(var(--t-bg-base) / <alpha-value>)",
          surface: "rgb(var(--t-bg-surface) / <alpha-value>)",
          elevated: "rgb(var(--t-bg-elevated) / <alpha-value>)",
          overlay: "rgba(17,20,16,.72)",
        },
        brand: {
          primary: "rgb(var(--t-accent) / <alpha-value>)",
          secondary: "rgb(var(--t-accent2) / <alpha-value>)",
          accent: "rgb(var(--t-accent3) / <alpha-value>)",
          glow: "rgb(var(--t-accent) / .18)",
        },
        border: {
          DEFAULT: "rgb(var(--t-border) / .12)",
          focus: "rgb(var(--t-accent) / .55)",
          hover: "rgb(var(--t-border) / .22)",
        },
        text: {
          primary: "rgb(var(--t-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--t-text-secondary) / <alpha-value>)",
          muted: "rgb(var(--t-text-muted) / <alpha-value>)",
          accent: "rgb(var(--t-text-accent) / <alpha-value>)",
        },
        status: {
          success: "#5AA63C",
          warning: "#B7791F",
          danger: "#C94C43",
          info: "#687064",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Segoe UI Variable",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: ["Cascadia Code", "Consolas", "monospace"],
      },
      fontSize: { "2xs": ["0.625rem", { lineHeight: "0.875rem" }] },
      backgroundImage: {
        "gradient-brand":
          "linear-gradient(135deg,rgb(var(--t-accent)),rgb(var(--t-accent2)))",
        "gradient-blue":
          "linear-gradient(135deg,rgb(var(--t-accent)),rgb(var(--t-accent2)))",
        "gradient-danger": "linear-gradient(135deg,#C94C43,#AA3731)",
        "gradient-success": "linear-gradient(135deg,#5AA63C,#3F7F2A)",
      },
      boxShadow: {
        glass: "var(--t-glass-shadow)",
        "glow-sm": "0 0 0 4px rgb(var(--t-accent) / .1)",
        "glow-md": "0 0 0 5px rgb(var(--t-accent) / .12)",
        "glow-lg": "0 0 0 6px rgb(var(--t-accent) / .13)",
        card: "var(--t-card-shadow)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(.4,0,.6,1) infinite",
        "spin-slow": "spin 3s linear infinite",
        shimmer: "shimmer 1.6s infinite",
        "scan-line": "scanLine 2s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        scanLine: {
          "0%": { top: "0%", opacity: ".65" },
          "100%": { top: "100%", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
