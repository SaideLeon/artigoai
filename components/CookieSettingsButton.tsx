"use client";

import { Cookie } from "lucide-react";
import { OPEN_COOKIE_CONSENT_EVENT } from "@/components/CookieConsentBanner";

export default function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(OPEN_COOKIE_CONSENT_EVENT));
      }}
      className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white whitespace-nowrap"
    >
      <Cookie className="h-3.5 w-3.5 shrink-0" />
      <span>Preferências de cookies</span>
    </button>
  );
}
