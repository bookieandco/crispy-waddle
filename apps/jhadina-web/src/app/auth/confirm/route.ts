import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { safeAuthNext } from "@/lib/auth/passkey";

/** Confirm a Supabase email token or PKCE code without trusting next as a URL. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeAuthNext(searchParams.get("next"));
  const destination = new URL(next, request.url);

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = destination.pathname;
  redirectTo.search = destination.search;
  redirectTo.hash = "";

  if ((tokenHash && type) || code) {
    try {
      const supabase = await createClient();
      const { error } = tokenHash && type
        ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        : await supabase.auth.exchangeCodeForSession(code!);
      if (!error) return NextResponse.redirect(redirectTo);
    } catch {
      // Provider failures are not successful confirmations.
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.search = "";
  redirectTo.searchParams.set("error", "confirmation_failed");
  redirectTo.searchParams.set("next", next);
  return NextResponse.redirect(redirectTo);
}
