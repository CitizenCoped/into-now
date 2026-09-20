import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        /** Anton (next/font/google) — italic uppercase display face for wordmark, titles, CTAs. */
        display: ["var(--font-display)", "Impact", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
