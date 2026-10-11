import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "./public-config";

const SELF_AUTHENTICATED_MACHINE_ROUTES = new Set([
  "/api/health",
  "/api/director/process-replication/reconcile",
  "/api/director/studies/observations",
  "/api/director/live-certification",
  "/api/director/bonez/bootstrap",
  "/api/director/hunyuan/health",
  "/api/director/bonez/voice-audition/bootstrap",
  "/api/director/bonez/quality-preflight",
  "/api/director/bonez/speaker-fingerprint/bootstrap",
  "/api/jhadina/voice/health",
  "/api/music/restoration/health",
  "/api/music/restoration/canary/prepare",
  "/api/music/restoration/canary/execute",
]);

/** Only audited, nonsecret, static local-game pages and assets; no API routes. */
export const PUBLIC_LOCAL_GAMING_PATHS:ReadonlySet<string>=new Set([
  "/gaming",
  "/gaming/diagnostics/diagnostics.js",
  "/gaming/diagnostics/index.html",
  "/gaming/gameboy/backup.js",
  "/gaming/gameboy/homebrew/2048.gb",
  "/gaming/gameboy/homebrew/LICENSE",
  "/gaming/gameboy/homebrew/README.md",
  "/gaming/gameboy/index.html",
  "/gaming/gameboy/player.html",
  "/gaming/gameboy/storage.js",
  "/gaming/neon-run/app.js",
  "/gaming/neon-run/engine.js",
  "/gaming/neon-run/icon.svg",
  "/gaming/neon-run/index.html",
  "/gaming/neon-run/manifest.webmanifest",
  "/gaming/neon-run/offline.js",
  "/gaming/neon-run/sw.js",
  "/vendor/binjgb/approved/LICENSE",
  "/vendor/binjgb/approved/LICENSE.gbstudio",
  "/vendor/binjgb/approved/binjgb.js",
  "/vendor/binjgb/approved/binjgb.wasm",
  "/vendor/binjgb/approved/jhadina-simple.js",
  "/vendor/binjgb/approved/manifest.json",
  "/vendor/binjgb/approved/simple.css"
]);

function isSelfAuthenticatedMachineRoute(pathname: string): boolean {
  return pathname.startsWith("/api/internal/") ||
    SELF_AUTHENTICATED_MACHINE_ROUTES.has(pathname);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // These machine routes enforce their own bearer-secret boundary. Requiring a
  // browser Supabase session in front of them would make CRON/worker callbacks
  // impossible and, when public auth env is absent, used to crash middleware
  // before the route could fail closed on its own secret.
  if (isSelfAuthenticatedMachineRoute(pathname)) {
    return response;
  }

  // Rendering the sign-in form must not depend on database availability.
  // Successful login, account creation and access to private routes remain
  // independently subject to Supabase Auth, cookies and RLS.
  if ((request.method === "GET" || request.method === "HEAD") && pathname === "/login") {
    return response;
  }

  // Gameplay and saves are device-local. Do not call Supabase while offline,
  // including when Auth/database is unavailable. All private routes remain gated.
  if ((request.method === "GET" || request.method === "HEAD") && PUBLIC_LOCAL_GAMING_PATHS.has(pathname)) {
    return response;
  }

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname === "/jhadina-voice-audition.html" ||
    pathname.startsWith("/jhadina-voice-audition/");

  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );

          Object.entries(headers).forEach(([header, value]) =>
            response.headers.set(header, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user && !isPublicRoute) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}
