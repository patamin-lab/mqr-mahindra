import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#c8102e",
          redDark: "#9c0c24",
          redLight: "#e63950",
          dark: "#1a1d23",
          gray: "#5b6168",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 8px 24px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)",
        glow: "0 4px 14px rgba(200, 16, 46, 0.28)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #e0153a 0%, #9c0c24 100%)",
        "gradient-dark": "linear-gradient(135deg, #2a2e36 0%, #1a1d23 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
