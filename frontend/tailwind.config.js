/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        stockzo: {
          background: "var(--color-background)",
          emerald: "var(--color-emerald)",
          ink: "var(--color-ink)",
          secondary: "var(--color-secondary)",
          border: "var(--color-border)",
          positive: "var(--color-positive)",
          negative: "var(--color-negative)",
        },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      boxShadow: {
        glass: "0 14px 40px rgba(15, 23, 42, 0.07)",
        soft: "0 8px 26px rgba(15, 23, 42, 0.06)",
      },
      borderRadius: { glass: "20px" },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { rise: "rise .6s ease-out both", shimmer: "shimmer 1.4s infinite" },
    },
  },
  plugins: [],
};
