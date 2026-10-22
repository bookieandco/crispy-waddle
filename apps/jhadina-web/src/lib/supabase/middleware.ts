import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "./public-config";
import { isLocalMusicPreviewRoute } from "@/lib/music/local-route-policy";

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
  // The stream endpoint performs signed-capability and owner checks itself.
  // Cast receivers have no Supabase browser cookie, so middleware cannot redirect them.
  "/api/jhadinatv/jellyfin/stream",
]);

function isSelfAuthenticatedMachineRoute(pathname: string): boolean {
  return pathname.startsWith("/api/internal/") ||
    SELF_AUTHENTICATED_MACHINE_ROUTES.has(pathname);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Browser-local audio uses Vercel Authentication on preview deployments.
  // No production route or /api route receives this exception.
  if (isLocalMusicPreviewRoute(pathname, process.env.VERCEL_ENV) ||
    (process.env.VERCEL_ENV === "preview" && request.method === "GET" &&
      ["/api/music/youtube/search","/api/music/youtube/playlist",
       "/api/music/youtube/status","/api/auth/youtube/start","/api/auth/youtube/callback"].includes(pathname))) return response;

  // These machine routes enforce their own bearer-secret boundary. Requiring a
  // browser Supabase session in front of them would make CRON/worker callbacks
  // impossible and, when public auth env is absent, used to crash middleware
  // before the route could fail closed on its own secret.
  if (isSelfAuthenticatedMachineRoute(pathname)) {
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
