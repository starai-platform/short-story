import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#201b18",
        paper: "#f7f2e9",
        ember: "#c65d3b",
        moss: "#496557",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(62, 48, 38, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
