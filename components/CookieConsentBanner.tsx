"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Cookie, ShieldCheck, X } from "lucide-react";

const CONSENT_STORAGE_KEY = "artigoai:consent:v1";
const CONSENT_COOKIE_NAME = "artigen_consent";
const POLICY_VERSION = "2026-11-22";
export const OPEN_COOKIE_CONSENT_EVENT = "artigen:open-cookie-consent";

type StoredConsent = {
  accepted: boolean;
  version: string;
  acceptedAt: string;
  policies: string[];
};

function readStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredConsent>;
      if (parsed && parsed.accepted === true && parsed.version === POLICY_VERSION) {
        return {
          accepted: true,
          version: parsed.version,
          acceptedAt: parsed.acceptedAt || "",
          policies: Array.isArray(parsed.policies) ? parsed.policies : [],
        };
      }
    }
  } catch {
    // Fallback para cookie se localStorage estiver bloqueado
  }

  try {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const found = cookies.find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`));
    if (found && found.includes(POLICY_VERSION)) {
      return {
        accepted: true,
        version: POLICY_VERSION,
        acceptedAt: "",
        policies: ["cookies", "termos-de-uso", "privacidade", "reembolso-e-cancelamento"],
      };
    }
  } catch {
    // Ignora falha ao ler document.cookie
  }

  return null;
}

function persistConsent(): StoredConsent {
  const payload: StoredConsent = {
    accepted: true,
    version: POLICY_VERSION,
    acceptedAt: new Date().toISOString(),
    policies: [
      "cookies",
      "termos-de-uso",
      "privacidade",
      "reembolso-e-cancelamento",
    ],
  };

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignora se localStorage estiver indisponível
  }

  try {
    const secureFlag =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${CONSENT_COOKIE_NAME}=accepted_${POLICY_VERSION}; path=/; max-age=31536000; SameSite=Lax${secureFlag}`;
  } catch {
    // Ignora se document.cookie estiver indisponível
  }

  return payload;
}

function formatConsentDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function CookieConsentBanner() {
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [existingConsent, setExistingConsent] = useState<StoredConsent | null>(
    null
  );

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;
      const stored = readStoredConsent();
      if (stored) {
        setExistingConsent(stored);
        setVisible(false);
      } else {
        setExistingConsent(null);
        setVisible(true);
      }
    });

    const handleOpenRequest = () => {
      const stored = readStoredConsent();
      setExistingConsent(stored);
      setVisible(true);
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key !== CONSENT_STORAGE_KEY) return;
      const stored = readStoredConsent();
      setExistingConsent(stored);
      if (stored) setVisible(false);
    };

    window.addEventListener(OPEN_COOKIE_CONSENT_EVENT, handleOpenRequest);
    window.addEventListener("storage", handleStorageSync);

    return () => {
      active = false;
      window.removeEventListener(OPEN_COOKIE_CONSENT_EVENT, handleOpenRequest);
      window.removeEventListener("storage", handleStorageSync);
    };
  }, []);

  const handleConfirmAccept = useCallback(() => {
    const saved = persistConsent();
    setExistingConsent(saved);
    setVisible(false);
  }, []);

  const handleDismissExisting = useCallback(() => {
    if (!existingConsent) return;
    setVisible(false);
  }, [existingConsent]);

  const formattedDate = existingConsent
    ? formatConsentDate(existingConsent.acceptedAt)
    : "";

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          key="cookie-consent-banner"
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-desc"
          initial={
            prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }
          }
          animate={
            prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
          }
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 lg:p-5"
        >
          <div className="pointer-events-auto mx-auto max-w-[1140px] rounded-2xl border border-slate-200/95 bg-white/95 p-4 shadow-xl shadow-slate-950/10 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-black/40 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  aria-hidden="true"
                  className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400"
                >
                  <Cookie className="h-5 w-5" />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h2
                      id="cookie-consent-title"
                      className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white"
                    >
                      <ShieldCheck
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 sm:hidden"
                      />
                      <span>Cookies e Aceite das Políticas</span>
                    </h2>

                    {existingConsent ? (
                      <button
                        type="button"
                        onClick={handleDismissExisting}
                        aria-label="Fechar aviso de cookies"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <p
                    id="cookie-consent-desc"
                    className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-300"
                  >
                    Usamos cookies essenciais e armazenamento local para manter
                    sua sessão segura, salvar preferências e processar
                    pagamentos. Ao acessar e utilizar o Artigen, você concorda
                    com a{" "}
                    <Link
                      href="/politica-de-cookies"
                      className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Política de Cookies
                    </Link>
                    , os{" "}
                    <Link
                      href="/termos-de-uso"
                      className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Termos de Uso
                    </Link>
                    , a{" "}
                    <Link
                      href="/privacidade"
                      className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Política de Privacidade (LGPD)
                    </Link>{" "}
                    e a{" "}
                    <Link
                      href="/reembolso-e-cancelamento"
                      className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Política de Reembolso
                    </Link>
                    . Confirme abaixo para continuar.
                  </p>

                  {formattedDate ? (
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      Confirmação registrada em {formattedDate}. Você pode
                      reconfirmar seu aceite a qualquer momento.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Link
                  href="/politica-de-cookies"
                  className="inline-flex min-h-[44px] sm:min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  Ler políticas
                </Link>

                <button
                  type="button"
                  onClick={handleConfirmAccept}
                  className="inline-flex min-h-[44px] sm:min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 whitespace-nowrap"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span>
                    {existingConsent
                      ? "Reconfirmar aceite"
                      : "Confirmar e aceitar"}
                  </span>
                </button>

                {existingConsent ? (
                  <button
                    type="button"
                    onClick={handleDismissExisting}
                    aria-label="Fechar aviso de cookies"
                    className="hidden lg:inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
