import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2A658F",
          dark: "#1e4f6e",
          light: "#3d7ba8",
        },
        dark: {
          DEFAULT: "#27273D",
          light: "#3a3a54",
        },
      },
    },
  },
  plugins: [],
};

export default config;
