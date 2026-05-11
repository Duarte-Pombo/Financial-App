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
        // Base editorial
        cream: "#F9F6F0",
        ivory: "#FFFDF7",
        ink: "#1A1612",
        "ink-muted": "#4A4440",
        "ink-faint": "#9A918C",
        parchment: "#EDE8DF",
        "parchment-dark": "#DDD6C9",

        // Emotions
        sadness: "#4A7FA5",       // azul
        "sadness-light": "#C5DCED",
        stress: "#E87040",        // laranja
        "stress-light": "#FADDD0",
        happy: "#D4A017",         // dourado
        "happy-light": "#F5E6B0",
        anxiety: "#3AACA0",       // verde-água
        "anxiety-light": "#B8E4E0",
        calm: "#4E9B6F",          // verde
        "calm-light": "#C0E2CE",
        anger: "#C0392B",         // vermelho
        "anger-light": "#F5C0BB",
        boredom: "#7B5EA7",       // roxo
        "boredom-light": "#DCCFF0",
        excited: "#E05A8A",       // rosa
        "excited-light": "#F9C9DC",
      },
      fontFamily: {
        playfair: ["PlayfairDisplay_400Regular"],
        "playfair-italic": ["PlayfairDisplay_400Regular_Italic"],
        "playfair-bold": ["PlayfairDisplay_700Bold"],
        "playfair-bold-italic": ["PlayfairDisplay_700Bold_Italic"],
      },
    },
  },
  plugins: [],
};
