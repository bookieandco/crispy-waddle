import type { Config } from "tailwindcss";

// Brand DNA sampled directly from the real boutique photo.
// Do not introduce new colors outside this palette without
// re-sampling the store image.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#EED8BE",
        "honey-oak": "#AE7841",
        bronze: "#714A26",
        ink: "#171716",
        greige: "#BEA991",
        gold: {
          DEFAULT: "#FFD24C",
          soft: "rgba(255, 210, 80, 0.75)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        "gold-glow": "0 0 18px rgba(255, 210, 80, 0.75)",
        "gold-glow-lg": "0 0 32px rgba(255, 210, 80, 0.55)",
      },
      transitionDuration: {
        225: "225ms",
      },
    },
  },
  plugins: [],
};

export default config;
