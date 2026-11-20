"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider, testConnection } from "@/lib/firebase";
import { upsertUserProfile } from "@/lib/firestore-service";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  profileReady: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  profileReady: false,
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => null,
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    void testConnection();

    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setUser(nextUser);

      if (nextUser) {
        setProfileReady(false);
        try {
          await upsertUserProfile(nextUser);
          if (active) setProfileReady(true);
        } catch (err) {
          console.error("Erro ao sincronizar perfil do utilizador:", err);
          if (active) {
            setAuthError(
              "Não foi possível sincronizar o perfil na nuvem. Tente novamente."
            );
          }
        }
      } else {
        setProfileReady(false);
      }

      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await upsertUserProfile(cred.user);
        setProfileReady(true);
      }
      return cred.user;
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : "";

      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        return null;
      }

      if (code === "auth/popup-blocked") {
        setAuthError(
          "O navegador bloqueou a janela de login do Google. Permita popups para continuar."
        );
      } else if (code === "auth/unauthorized-domain") {
        setAuthError(
          "Este domínio ainda não está autorizado para autenticação Google."
        );
      } else {
        setAuthError("Falha ao entrar com Google. Tente novamente.");
      }
      return null;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
      setProfileReady(false);
    } catch {
      setAuthError("Não foi possível encerrar a sessão.");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profileReady,
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
