/** @type {import('tailwindcss').Config} */
// All colors resolve to design tokens in src/styles/tokens.css.
// Do not add raw hex values here or in components.
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const line = (level) =>
  `rgb(var(--c-line) / calc(var(--a-line-${level}) * <alpha-value>))`;

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Design system names ──────────────────────────────────────
        surface: {
          base: c("surface-base"),
          inset: c("surface-inset"),
          chrome: c("surface-chrome"),
          raised: c("surface-raised"),
          overlay: c("surface-overlay"),
          popover: c("surface-popover"),
        },
        fg: {
          1: c("fg-1"),
          2: c("fg-2"),
          3: c("fg-3"),
          4: c("fg-4"),
          "on-brand": c("fg-on-brand"),
        },
        line: {
          subtle: line(1),
          DEFAULT: line(2),
          strong: line(3),
        },
        state: c("state"),
        scrim: c("scrim"),
        brand: {
          DEFAULT: c("brand"),
          solid: c("brand-solid"),
          "solid-hover": c("brand-solid-hover"),
          fg: c("brand-fg"),
          soft: c("brand-soft"),
          // legacy names
          primary: c("brand"),
          secondary: c("brand-solid"),
          accent: c("brand"),
          glow: "rgb(var(--c-brand) / .18)",
        },
        success: { DEFAULT: c("success"), fg: c("success-fg"), soft: c("success-soft") },
        warning: { DEFAULT: c("warning"), fg: c("warning-fg"), soft: c("warning-soft") },
        danger: { DEFAULT: c("danger"), fg: c("danger-fg"), soft: c("danger-soft") },
        info: { DEFAULT: c("info"), fg: c("info-fg"), soft: c("info-soft") },
        chart: { 1: c("chart-1"), 2: c("chart-2") },

        // ── Legacy names (kept so unconverted pages keep working) ───
        bg: {
          base: c("surface-base"),
          surface: c("surface-chrome"),
          elevated: c("surface-raised"),
          overlay: "rgb(var(--c-scrim) / var(--a-scrim))",
        },
        border: {
          DEFAULT: line(2),
          focus: "rgb(var(--c-brand) / .55)",
          hover: line(3),
        },
        text: {
          primary: c("fg-1"),
          secondary: c("fg-2"),
          muted: c("fg-3"),
          accent: c("brand-fg"),
        },
        status: {
          success: c("success"),
          warning: c("warning"),
          danger: c("danger"),
          info: c("info"),
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        // Type scale (size / line-height / tracking)
        caption: ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        "body-sm": ["12px", { lineHeight: "18px", letterSpacing: "0" }],
        body: ["13px", { lineHeight: "20px", letterSpacing: "-0.003em" }],
        title: ["15px", { lineHeight: "22px", letterSpacing: "-0.012em" }],
        h1: ["22px", { lineHeight: "28px", letterSpacing: "-0.022em" }],
        metric: ["26px", { lineHeight: "30px", letterSpacing: "-0.03em" }],
        display: ["40px", { lineHeight: "44px", letterSpacing: "-0.04em" }],
      },
      // Semantic radius names so Tailwind's default rounded-* stay intact
      // for unconverted pages. chip 6 / control 10 / card 14 / panel 20.
      borderRadius: {
        tiny: "var(--radius-xs)",
        chip: "var(--radius-sm)",
        control: "var(--radius-md)",
        card: "var(--radius-lg)",
        panel: "var(--radius-xl)",
      },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        3: "var(--shadow-3)",
        4: "var(--shadow-4)",
        brand: "var(--shadow-brand)",
        ring: "var(--ring)",
        "highlight-top": "var(--highlight-top)",
        // legacy names
        glass: "var(--shadow-1)",
        card: "var(--shadow-1)",
        "glow-sm": "0 0 0 4px rgb(var(--c-brand) / .1)",
        "glow-md": "0 0 0 5px rgb(var(--c-brand) / .12)",
        "glow-lg": "0 0 0 6px rgb(var(--c-brand) / .13)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      backgroundImage: {
        "gradient-brand":
          "linear-gradient(180deg,rgb(var(--c-brand-solid-top)),rgb(var(--c-brand-solid)))",
        "gradient-blue":
          "linear-gradient(180deg,rgb(var(--c-brand-solid-top)),rgb(var(--c-brand-solid)))",
        "gradient-danger": "linear-gradient(180deg,rgb(var(--c-danger)),rgb(var(--c-danger-fg)))",
        "gradient-success":
          "linear-gradient(180deg,rgb(var(--c-brand-solid-top)),rgb(var(--c-brand-solid)))",
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
