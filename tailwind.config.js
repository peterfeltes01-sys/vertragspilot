/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#0B0F19",
          800: "#111827",
          700: "#1E293B",
          600: "#334155",
          500: "#475569",
        },
      },
    },
  },
  plugins: [],
};
