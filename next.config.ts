import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function buildContentSecurityPolicy(): string {
  const supabaseOrigin = (() => {
    try {
      const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      return raw ? new URL(raw).origin : "";
    } catch {
      return "";
    }
  })();

  const supabaseWsOrigin = supabaseOrigin
    ? supabaseOrigin.replace(/^https?:/, "wss:")
    : "";

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.stripe.com",
    "https://checkout.stripe.com",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
    ...(supabaseWsOrigin ? [supabaseWsOrigin] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    `connect-src ${connectSrc}`,
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
