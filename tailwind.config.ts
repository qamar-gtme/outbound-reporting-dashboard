import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0c10",
        panel: "#14161d",
        panel2: "#0e1015",
        border: "#1a1c24",
        ink: "#e6e8ee",
        ink2: "#d3d6de",
        muted: "#aab2bd",
        dim: "#6f7682",
        accent: "#5fd7a8",
        warn: "#f3c969",
        loss: "#d77777",
        info: "#a9a9f3",
      },
      fontFamily: {
        sans: ["Supreme", "system-ui", "sans-serif"],
        serif: ["Erode", "Georgia", "serif"],
        mono: ["Martian Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
