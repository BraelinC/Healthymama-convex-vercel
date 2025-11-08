import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./convex/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "recipeai-bg": "#0f172a",
        "recipeai-panel": "#1e293b",
        "recipeai-accent": "#dc2626",
        "healthymama-red": "#dc2626",
        "healthymama-pink": "#ec4899",
        "healthymama-logo-pink": "#EC407A",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "glow": "0 8px 30px rgba(220, 38, 38, 0.35)",
        "red-glow": "0 8px 30px rgba(220, 38, 38, 0.35)",
        "red-hover": "0 0 0 3px rgba(220, 38, 38, 0.1)"
      }
    },
  },
  plugins: [],
};

export default config;
