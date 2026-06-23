import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#c8102e",
          redDark: "#9c0c24",
          dark: "#1a1d23",
          gray: "#5b6168",
        },
      },
    },
  },
  plugins: [],
};
export default config;
