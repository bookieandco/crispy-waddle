import { type NextRequest } from "next/server";
import { updateSession } from "./src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Local CI-only bypass used by the production-bundle UX smoke test.
  // Vercel deployments can never activate this path, even if the variable
  // were accidentally configured there.
  if (
    process.env.CI === "true" &&
    process.env.JHADINA_E2E_BYPASS_AUTH === "1" &&
    process.env.VERCEL !== "1"
  ) {
    return;
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
