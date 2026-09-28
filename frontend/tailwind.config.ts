import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#FAF7F2",
        card: "#FFFDF9",
        primary: "#0F172A",
        accent: "#2563EB",
      },
      fontFamily: {
        sans: ["Segoe UI", "Inter", "-apple-system", "BlinkMacSystemFont", "Roboto", "sans-serif"],
        heading: ["Segoe UI", "Outfit", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;