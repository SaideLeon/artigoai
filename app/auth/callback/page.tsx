"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

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
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else {
        await supabase.auth.getSession();
      }
      if (!cancelled) {
        router.replace("/studio");
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
