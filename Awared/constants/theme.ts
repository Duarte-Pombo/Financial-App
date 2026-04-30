// Awared Mindful Finance — Design tokens (mirrors the real Stitch HTML export)
// Vibrant Purple + Magenta palette with glassmorphism aesthetic.
// All values match the tailwind config exported from each Stitch screen.

export const colors = {
  // Surfaces
  background: "#f9f9ff",
  surface: "#f9f9ff",
  surfaceBright: "#f9f9ff",
  surfaceDim: "#d3daea",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f0f3ff",
  surfaceContainer: "#e7eefe",
  surfaceContainerHigh: "#e2e8f8",
  surfaceContainerHighest: "#dce2f3",
  surfaceVariant: "#dce2f3",

  // Text
  onSurface: "#151c27",
  onSurfaceVariant: "#4a4455",
  onBackground: "#151c27",
  onPrimary: "#ffffff",
  onPrimaryContainer: "#ede0ff",
  onPrimaryFixed: "#25005a",
  onPrimaryFixedVariant: "#5a00c6",
  onSecondary: "#ffffff",
  onSecondaryContainer: "#600037",
  onSecondaryFixed: "#3e0022",
  onSecondaryFixedVariant: "#8c0053",
  onTertiary: "#ffffff",
  onTertiaryContainer: "#f2e0ff",
  onTertiaryFixed: "#29074a",
  onTertiaryFixedVariant: "#573878",
  inverseOnSurface: "#ebf1ff",
  inverseSurface: "#2a313d",

  // Outlines
  outline: "#7b7487",
  outlineVariant: "#ccc3d8",

  // Primary — Vibrant Purple
  primary: "#630ed4",
  primaryContainer: "#7c3aed",
  primaryFixed: "#eaddff",
  primaryFixedDim: "#d2bbff",
  inversePrimary: "#d2bbff",
  surfaceTint: "#732ee4",

  // Secondary — Pink/Magenta
  secondary: "#b4136d",
  secondaryContainer: "#fd56a7",
  secondaryFixed: "#ffd9e4",
  secondaryFixedDim: "#ffb0cd",

  // Tertiary — Soft Purple
  tertiary: "#5f4181",
  tertiaryContainer: "#78599b",
  tertiaryFixed: "#efdbff",
  tertiaryFixedDim: "#dbb8ff",

  // Status
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  onError: "#ffffff",
  onErrorContainer: "#93000a",

  // Top app bar / nav
  navBg: "#f8fafc",          // slate-50
  navBorder: "#e0e7ff33",    // indigo-100/20
  indigoText: "#312e81",     // indigo-900
  indigoActiveBg: "#eef2ff80", // indigo-50/50
  indigoActiveText: "#4338ca", // indigo-700
  navInactive: "#94a3b8",    // slate-400
} as const;

export const radii = {
  sm: 8,
  md: 12,
  base: 16,    // tailwind DEFAULT (1rem)
  lg: 32,      // tailwind lg (2rem)
  xl: 48,      // tailwind xl (3rem)
  pill: 9999,
} as const;

export const spacing = {
  xs: 4,
  base: 8,
  sm: 12,
  gutter: 16,
  containerMargin: 24,
  md: 24,
  lg: 40,
  xl: 64,
} as const;

// Manrope ONLY (matches the Stitch design)
export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
} as const;

// Type scale matching the tailwind tokens 1:1
export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 48, lineHeight: 56, letterSpacing: -0.96 },
  headlineLg: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.32 },
  headlineMd: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32 },
  bodyLg: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 28 },
  bodyMd: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  labelLg: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 0.14 },
  labelSm: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
} as const;

// Stitch uses indigo-tinted soft shadows (rgba(124,58,237, 0.04-0.08)) on glass cards.
// React Native doesn't support backdrop-filter, so we approximate with white surface + tinted shadow.
export const elevation = {
  glass: {
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 4,
  },
  card: {
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  raised: {
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  navTop: {
    shadowColor: "#1e2238",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 12,
  },
} as const;

// Glass card preset ("bg-white/60 backdrop-blur-xl border-white/40 shadow-glass")
export const glassCard = {
  backgroundColor: "rgba(255,255,255,0.92)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.8)",
  ...elevation.glass,
} as const;
