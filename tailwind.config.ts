import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#08090d",
        surface: "#0e1015",
        surface2: "#13161d",
        surface3: "#181b24",
        line: "#1e212b",
        line2: "#2a2e3a",
        ink: "#f5f6f9",
        ink2: "#cdd1db",
        muted: "#9aa0ad",
        dim: "#5b6170",
        accent: "#5fd7a8",
        accent2: "#3cbf8d",
        warn: "#f3c969",
        loss: "#e08585",
        info: "#9fb3ff",
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
    },
  },
  plugins: [],
} satisfies Config;
