/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#005bbd",
        secondary: "#7622e5",
        tertiary: "#895100",
        error: "#ba1a1a",
        surface: "#f9f9ff",
        surfaceContainer: "#e7eeff",
        surfaceContainerHigh: "#dee8ff",
        neutral: {
          50: "#f9f9ff",
          100: "#f3f3ff",
          200: "#e0e0e0",
          600: "#757575",
          700: "#616161",
          800: "#424242",
          900: "#1b1b1f",
        },
      },
      fontFamily: {
        sans: ["Inter", "System", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.08)",
        neumorphic: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
        volumetric: "0 8px 32px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};
