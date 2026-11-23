import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
  sanitizeRefCode,
} from "@/lib/referral-constants";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

export const createClient = (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!supabaseUrl || !supabaseKey) {
    return { supabase: null, supabaseResponse };
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  return { supabase, supabaseResponse };
};

async function validateAndTrackReferralCode(code: string): Promise<boolean> {
  if (!supabaseUrl) return false;
  const authKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    supabaseKey;
  if (!authKey) return false;

  const isOpaqueSupabaseKey =
    authKey.startsWith("sb_secret_") || authKey.startsWith("sb_publishable_");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: authKey,
  };
  if (!isOpaqueSupabaseKey) {
    headers.Authorization = `Bearer ${authKey}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1800);

  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/track_referral_visit`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ p_codigo: code }),
        signal: controller.signal,
        cache: "no-store",
      }
    );

    if (!res.ok) return false;
    const result = (await res.json()) as unknown;
    return result === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function updateSession(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  if (supabase) {
    // Refreshes the user's auth token cookie when needed
    await supabase.auth.getUser();
  }

  const isNavigationGet =
    request.method === "GET" &&
    !request.nextUrl.pathname.startsWith("/api/") &&
    !request.headers.get("next-router-prefetch") &&
    request.headers.get("purpose") !== "prefetch";

  if (isNavigationGet) {
    const rawRef = request.nextUrl.searchParams.get("ref");
    const sanitizedRef = sanitizeRefCode(rawRef);
    const existingCookieRef = sanitizeRefCode(
      request.cookies.get(REFERRAL_COOKIE_NAME)?.value
    );

    // Regra first-touch: só grava novo cookie se ainda não houver um cookie de indicação válido
    if (sanitizedRef && !existingCookieRef) {
      const isValidActivePartner = await validateAndTrackReferralCode(sanitizedRef);
      if (isValidActivePartner) {
        const hostname = request.nextUrl.hostname;
        const isHttps =
          request.headers.get("x-forwarded-proto") === "https" ||
          request.nextUrl.protocol === "https:" ||
          (process.env.NODE_ENV === "production" &&
            hostname !== "localhost" &&
            hostname !== "127.0.0.1");

        supabaseResponse.cookies.set(REFERRAL_COOKIE_NAME, sanitizedRef, {
          httpOnly: true,
          sameSite: "lax",
          secure: isHttps,
          path: "/",
          maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
        });
      }
    }
  }

  return supabaseResponse;
}
