import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Loopback-only production-bundle smoke bypass. Public deployments cannot
  // satisfy the loopback host check, so this cannot become an external auth
  // bypass even if the header is copied outside CI.
  const smokeHost = request.nextUrl.hostname;
  const localSmokeHost = smokeHost === "127.0.0.1" || smokeHost === "localhost" || smokeHost === "::1";
  if (
    localSmokeHost &&
    request.headers.get("x-jhadina-e2e-smoke") === "local-production-bundle"
  ) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
