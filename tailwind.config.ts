import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: "#F5F7FB",
        ink: "#0F172A",
        wood: "#1F2937",
        gold: "#60A5FA",
        teal: "#22D3EE",
        highlight: "#FDE68A",
        read: "#DBEAFE",
      },
      fontFamily: {
        lexie: [
          '"Lexie Readable"',
          "OpenDyslexic",
          "ui-serif",
          "Georgia",
          "serif",
        ],
      },
      maxWidth: {
        measure: "42rem",
      },
    },
  },
  plugins: [],
};
export default config;
