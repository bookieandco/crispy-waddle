import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SELF_AUTHENTICATED_MACHINE_ROUTES = new Set([
  "/api/director/process-replication/reconcile",
  "/api/director/studies/observations",
]);

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  return { url, key };
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // These machine routes enforce their own bearer-secret boundary. Requiring a
  // browser Supabase session in front of them would make CRON/worker callbacks
  // impossible and, when public auth env is absent, used to crash middleware
  // before the route could fail closed on its own secret.
  if (SELF_AUTHENTICATED_MACHINE_ROUTES.has(pathname)) {
    return response;
  }

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth");

  const { url, key } = publicSupabaseConfig();
  if (!url || !key) {
    if (isPublicRoute) return response;

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Authentication service is not configured" },
        { status: 503 },
      );
    }

    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    redirect.searchParams.set("auth", "unconfigured");
    return NextResponse.redirect(redirect);
  }

  const supabase = createServerClient(
    url,
    key,
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
