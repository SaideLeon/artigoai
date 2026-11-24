"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_THEME_GUEST = "artigoai:theme:v1";

function getUserThemeStorageKey(userId: string): string {
  return `artigen:theme:user:${userId}`;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeToDom(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

function readStoredTheme(key: string): Theme | null {
  try {
    const val = localStorage.getItem(key);
    return val === "dark" || val === "light" ? val : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(key: string, value: Theme) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignora indisponibilidade de localStorage
  }
}

function resolveDefaultTheme(): Theme {
  const guestStored = readStoredTheme(STORAGE_THEME_GUEST);
  if (guestStored) return guestStored;
  try {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
  } catch {
    // Ignora indisponibilidade de matchMedia
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [theme, setThemeState] = useState<Theme>("light");
  const lastRemoteThemeRef = useRef<{ uid: string; theme: Theme } | null>(null);
  const currentUid = user?.uid ?? null;

  useEffect(() => {
    let active = true;

    const syncTheme = async () => {
      if (authLoading) {
        const fallback = resolveDefaultTheme();
        if (!active) return;
        setThemeState(fallback);
        applyThemeToDom(fallback);
        return;
      }

      if (!currentUid) {
        lastRemoteThemeRef.current = null;
        const guestTheme = resolveDefaultTheme();
        if (!active) return;
        setThemeState(guestTheme);
        applyThemeToDom(guestTheme);
        return;
      }

      // 1) Aplica imediatamente preferência local específica deste usuário
      const userStorageKey = getUserThemeStorageKey(currentUid);
      const localUserTheme = readStoredTheme(userStorageKey);
      const initialForUser = localUserTheme ?? resolveDefaultTheme();
      if (!active) return;
      setThemeState(initialForUser);
      applyThemeToDom(initialForUser);

      // 2) Sincroniza com a preferência persistida no Supabase para este usuário
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from("user_settings")
        .select("theme")
        .eq("user_id", currentUid)
        .maybeSingle();

      if (!active || error || !data) return;
      if (data.theme === "dark" || data.theme === "light") {
        lastRemoteThemeRef.current = { uid: currentUid, theme: data.theme };
        writeStoredTheme(userStorageKey, data.theme);
        writeStoredTheme(STORAGE_THEME_GUEST, data.theme);
        setThemeState(data.theme);
        applyThemeToDom(data.theme);
      }
    };

    void syncTheme();

    return () => {
      active = false;
    };
  }, [authLoading, currentUid]);

  const persistTheme = useCallback((uid: string | null, next: Theme) => {
    writeStoredTheme(STORAGE_THEME_GUEST, next);
    if (!uid) return;

    writeStoredTheme(getUserThemeStorageKey(uid), next);

    if (
      lastRemoteThemeRef.current?.uid === uid &&
      lastRemoteThemeRef.current?.theme === next
    ) {
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    lastRemoteThemeRef.current = { uid, theme: next };
    void supabase
      .from("user_settings")
      .upsert(
        {
          user_id: uid,
          theme: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .then(({ error }) => {
        if (error) {
          console.error("Erro ao guardar tema do utilizador:", error.message);
        }
      });
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      applyThemeToDom(next);
      persistTheme(currentUid, next);
    },
    [currentUid, persistTheme]
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyThemeToDom(next);
      persistTheme(currentUid, next);
      return next;
    });
  }, [currentUid, persistTheme]);

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
