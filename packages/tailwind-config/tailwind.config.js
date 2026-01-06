/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        dancing: ["var(--font-dancing)", "cursive"],
      },
      colors: {
        "recipeai-bg": "#0f172a",
        "recipeai-panel": "#1e293b",
        "recipeai-accent": "#dc2626",
        "healthymama-red": "#dc2626",
        "healthymama-pink": "#ec4899",
        "healthymama-logo-pink": "#EC407A",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glow: "0 8px 30px rgba(220, 38, 38, 0.35)",
        "red-glow": "0 8px 30px rgba(220, 38, 38, 0.35)",
        "red-hover": "0 0 0 3px rgba(220, 38, 38, 0.1)",
      },
    },
  },
  plugins: [],
};
