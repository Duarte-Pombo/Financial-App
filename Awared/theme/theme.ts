// ─── Awared theme palettes ───────────────────────────────────────────────────
// One shared shape (`ThemeColors`) drives every screen. Each screen used to
// declare its own local `const C = { ... }`; those keys are unified here so a
// single light/dark swap recolors the whole app. Emotion colors stay semantic
// and are NOT themed (they live in components/EmotionGlyph + tailwind.config.js).

export type ThemeColors = {
  // Surfaces
  bg: string; // app background
  panel: string; // cards / raised surfaces
  fieldBg: string; // input fields

  // Text
  ink: string; // primary text
  inkSoft: string; // secondary text
  inkMute: string; // tertiary / hint text

  // Lines
  rule: string; // standard hairline / border
  ruleSoft: string; // faint divider

  // Accent (purple)
  purple: string;
  purpleDeep: string; // accent text / stronger accent
  purpleSoft: string; // accent tint background

  // Semantic
  danger: string;
  green: string; // success / refunded accent

  // Screen-specific extras (calendar / insights / addPurchase)
  ringBg: string; // donut chart track
  blobBg: string; // emotion blob backdrop
  blackBtn: string; // solid primary button bg (paired with white text)
  recentRule: string; // accent rule on lists

  // Misc chrome
  white: string; // surfaces that should read as "card white" in both themes
};

export const lightColors: ThemeColors = {
  bg: "#F5F1EA",
  panel: "#FAF6EF",
  fieldBg: "rgba(31,27,22,0.02)",

  ink: "#1F1B16",
  inkSoft: "#5E574E",
  inkMute: "#9C9489",

  rule: "rgba(31,27,22,0.10)",
  ruleSoft: "rgba(31,27,22,0.06)",

  purple: "#9B82C9",
  purpleDeep: "#7E64B3",
  purpleSoft: "rgba(155,130,201,0.14)",

  danger: "#C24A3A",
  green: "#5F7A4F",

  ringBg: "#E5DECC",
  blobBg: "#ECE5D6",
  blackBtn: "#1F1B16",
  recentRule: "#9B82C9",

  white: "#FFFFFF",
};

export const darkColors: ThemeColors = {
  bg: "#15120E",
  panel: "#211B15",
  fieldBg: "rgba(242,236,225,0.05)",

  ink: "#F2ECE1",
  inkSoft: "#B7AEA1",
  inkMute: "#857C70",

  rule: "rgba(242,236,225,0.12)",
  ruleSoft: "rgba(242,236,225,0.07)",

  purple: "#B9A3E3",
  purpleDeep: "#C7B2EE",
  purpleSoft: "rgba(185,163,227,0.18)",

  danger: "#E8705C",
  green: "#8FAE78",

  ringBg: "#3A332A",
  blobBg: "#2A2620",
  blackBtn: "#6E58A6",
  recentRule: "#B9A3E3",

  white: "#211B15",
};

export type ThemeScheme = "light" | "dark";

export const palettes: Record<ThemeScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
