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
        survey: {
          dark: "#090d16",
          card: "rgba(15, 23, 42, 0.75)",
          border: "rgba(51, 65, 85, 0.6)",
          accent: "#06b6d4", // cyan-500
          highlight: "#10b981", // emerald-500
          rover: "#f59e0b", // amber-500
          alert: "#ef4444", // red-500
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.35)',
        'glow-rover': '0 0 25px rgba(245, 158, 11, 0.5)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
};
export default config;
