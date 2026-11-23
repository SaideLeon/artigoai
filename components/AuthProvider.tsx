"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { upsertUserProfile } from "@/lib/supabase-service";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  profileReady: boolean;
  supabaseConfigured: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  profileReady: false,
  supabaseConfigured: false,
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
});

function mapSupabaseUser(u: SupabaseUser): AppUser {
  const displayName =
    (u.user_metadata?.full_name as string | undefined) ||
    (u.user_metadata?.name as string | undefined) ||
    (u.email ? u.email.split("@")[0] : null);
  const photoURL =
    (u.user_metadata?.avatar_url as string | undefined) ||
    (u.user_metadata?.picture as string | undefined) ||
    null;

  return {
    uid: u.id,
    email: u.email ?? null,
    displayName,
    photoURL,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [profileReady, setProfileReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const attributedUsersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    let active = true;

    const syncUser = async (supaUser: SupabaseUser | null) => {
      if (!active) return;
      if (supaUser) {
        setUser(mapSupabaseUser(supaUser));
        setProfileReady(false);
        await upsertUserProfile(supaUser);
        if (!attributedUsersRef.current.has(supaUser.id)) {
          attributedUsersRef.current.add(supaUser.id);
          fetch("/api/referrals/attribute", { method: "POST" }).catch(() => {
            // Atribuição silenciosa no servidor
          });
        }
        if (active) setProfileReady(true);
      } else {
        setUser(null);
        setProfileReady(false);
      }
      if (active) setLoading(false);
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError("Não foi possível verificar a sessão no Supabase.");
        setLoading(false);
        return;
      }
      void syncUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void syncUser(session?.user ?? null);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async (nextPath?: string) => {
    setAuthError(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthError(
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para ativar o login Google com Supabase."
      );
      return;
    }

    const safeNext =
      typeof nextPath === "string" &&
      nextPath.startsWith("/") &&
      !nextPath.startsWith("//") &&
      !nextPath.startsWith("/auth")
        ? nextPath
        : "";

    try {
      if (safeNext) {
        sessionStorage.setItem("artigoai:auth_next", safeNext);
      } else {
        sessionStorage.removeItem("artigoai:auth_next");
      }
    } catch {
      // Ignora falha de sessionStorage
    }

    const redirectTo = safeNext
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
      : `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setAuthError("Falha ao iniciar sessão Google no Supabase.");
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError("Não foi possível encerrar a sessão.");
    } else {
      setUser(null);
      setProfileReady(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profileReady,
        supabaseConfigured: isSupabaseConfigured,
        authError,
        clearAuthError,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
