import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ThemeColors,
  ThemeScheme,
  palettes,
} from "@/theme/theme";

// "system" follows the OS appearance; "light"/"dark" force a scheme.
export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "@awared/theme-mode";

interface ThemeContextValue {
  /** User preference: light | dark | system */
  mode: ThemeMode;
  /** Resolved scheme actually in use: light | dark */
  scheme: ThemeScheme;
  /** Active color palette */
  colors: ThemeColors;
  /** true when scheme === "dark" */
  isDark: boolean;
  /** Persist a new preference */
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

/** Convenience: just the active palette. */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemScheme, setSystemScheme] = useState<ThemeScheme>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );

  // Restore saved preference on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") {
          setModeState(saved);
        }
      })
      .catch(() => {});
  }, []);

  // Track OS appearance changes (only matters while mode === "system").
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const scheme: ThemeScheme = mode === "system" ? systemScheme : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      scheme,
      colors: palettes[scheme],
      isDark: scheme === "dark",
      setMode,
    }),
    [mode, scheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
