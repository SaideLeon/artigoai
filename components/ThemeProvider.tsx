"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_THEME = "artigoai:theme:v1";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      let initial: Theme = "light";
      try {
        const stored = localStorage.getItem(STORAGE_THEME);
        if (stored === "dark" || stored === "light") {
          initial = stored;
        } else if (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
          initial = "dark";
        }
      } catch {
        // Ignora indisponibilidade de localStorage
      }
      setThemeState(initial);
      applyThemeToDom(initial);
    });
    return () => {
      active = false;
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeToDom(next);
    try {
      localStorage.setItem(STORAGE_THEME, next);
    } catch {
      // Ignora
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyThemeToDom(next);
      try {
        localStorage.setItem(STORAGE_THEME, next);
      } catch {
        // Ignora
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  }
  return ctx;
}
