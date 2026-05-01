/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#8b4b5c",
        "primary-container": "#f9a8bb",
        "on-primary": "#ffffff",
        "on-primary-container": "#773a4b",
        background: "#fff8f7",
        surface: "#fff8f7",
        "surface-container": "#f8ebec",
        "surface-lowest": "#ffffff",
        "surface-high": "#f2e5e6",
        "surface-highest": "#ecdfe1",
        "on-surface": "#201a1b",
        "on-surface-variant": "#524346",
        outline: "#847376",
        "outline-variant": "#d6c1c5",
        tertiary: "#366940",
        "tertiary-container": "#95cc9b",
        "on-tertiary-container": "#245731",
        secondary: "#8e4c40",
        "secondary-container": "#fea999",
        "on-secondary-container": "#793b30",
      },
    },
  },
  plugins: [],
};
