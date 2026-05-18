import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- New SaaS-shell tokens (preferred) ---------------------------
        background: "hsl(var(--bg) / <alpha-value>)",
        foreground: "hsl(var(--fg) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        popover: "hsl(var(--popover) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",

        // --- Legacy semantic aliases (kept so existing pages render) -----
        // The dashboard pages use bg-surface, text-ink, text-muted, etc.
        // We map them onto the same CSS vars so they automatically work in
        // both light and dark mode.
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        surface2: "hsl(var(--surface-2) / <alpha-value>)",
        surface3: "hsl(var(--surface-3) / <alpha-value>)",
        line: "hsl(var(--border) / <alpha-value>)",
        line2: "hsl(var(--border-strong) / <alpha-value>)",
        ink: "hsl(var(--fg) / <alpha-value>)",
        ink2: "hsl(var(--fg-2) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        dim: "hsl(var(--dim) / <alpha-value>)",

        accent: "hsl(var(--accent) / <alpha-value>)",
        accent2: "hsl(var(--accent) / <alpha-value>)",
        "accent-fg": "hsl(var(--accent-fg) / <alpha-value>)",
        warn: "hsl(var(--warn) / <alpha-value>)",
        loss: "hsl(var(--danger) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Sentient", "Iowan Old Style", "Georgia", "serif"],
        sans: ["Switzer", "Inter", "system-ui", "sans-serif"],
        serif: ["Erode", "Georgia", "serif"],
        mono: ["Martian Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      borderRadius: {
        lg: "10px",
        md: "8px",
        sm: "6px",
      },
    },
  },
  plugins: [],
} satisfies Config;
