"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

function resolveSafeRedirect(rawNext: string | null): string {
  if (
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/auth")
  ) {
    return rawNext;
  }
  return "/studio";
}

export default function SupabaseAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.replace("/studio");
      return;
    }

    let cancelled = false;
    const completeAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const queryNext = params.get("next");

      let storedNext: string | null = null;
      try {
        storedNext = sessionStorage.getItem("artigoai:auth_next");
        sessionStorage.removeItem("artigoai:auth_next");
      } catch {
        // Ignora
      }

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else {
        await supabase.auth.getSession();
      }

      // Vincula indicação se houver cookie HttpOnly de parceiro e conta for nova
      try {
        await fetch("/api/referrals/attribute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // Falha silenciosa não bloqueia login
      }

      if (!cancelled) {
        router.replace(resolveSafeRedirect(queryNext || storedNext));
      }
    };

    void completeAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB] text-slate-700 dark:bg-slate-950 dark:text-slate-200">
      <p className="text-sm font-medium">
        A concluir autenticação com Google no Supabase…
      </p>
    </div>
  );
}
