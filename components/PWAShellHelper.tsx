"use client";

import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/use-pwa-install";

export default function PWAShellHelper() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Ignore service worker registration errors in unsupported/restricted contexts
      });
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 shadow-lg dark:border-amber-700/80 dark:bg-amber-950/95 dark:text-amber-100"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Você está offline. Reconecte-se para gerar novos artigos.</span>
    </div>
  );
}
