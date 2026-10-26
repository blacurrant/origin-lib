/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    // A small, deliberate radius scale. Controls sit at 8 to 10, panels at 12 to 16, big surfaces
    // (tiles, the inspector) at 18 to 20, and only dots, switches and swatches stay round.
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "6px",
      md: "8px",
      lg: "10px",
      xl: "12px",
      "2xl": "16px",
      "3xl": "20px",
      full: "9999px",
    },
    extend: { fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] } },
  },
  plugins: [],
}
