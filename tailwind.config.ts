import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        academy: {
          blue: "var(--primary-blue)",
          orange: "var(--accent-orange)",
          light: "var(--light-grey)",
          border: "var(--border-grey)",
        },
        primary: {
          DEFAULT: "var(--primary-blue)",
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "var(--accent-orange)",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f6f7f9",
          foreground: "#6b7280",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#111827",
        },
      },
      borderRadius: {
        lg: "1rem",
        md: "0.875rem",
        sm: "0.75rem",
      },
      boxShadow: {
        shell: "0 24px 48px rgba(13, 59, 132, 0.08)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": {
            backgroundPosition: "-1000px 0",
          },
          "100%": {
            backgroundPosition: "1000px 0",
          },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;