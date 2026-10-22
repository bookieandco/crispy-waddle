import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { safeAuthNext } from "@/lib/auth/passkey";
import { isVerifiedPersonalOwner } from "@/lib/auth/personal-owner";

// A callback can carry an authentication credential in its incoming URL.
// Never cache these redirects or allow downstream referrer disclosures.
const privateRedirect = (destination: URL) => NextResponse.redirect(destination, {
  headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
});

export const dynamic = "force-dynamic";

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

  if ((tokenHash && type) || (code && code.length <= 4096)) {
    try {
      const supabase = await createClient();
      const { error } = tokenHash && type
        ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        : await supabase.auth.exchangeCodeForSession(code!);
      if (!error) {
        const { data, error: ownerError } = await supabase.auth.getUser();
        if (!ownerError && isVerifiedPersonalOwner(data.user)) return privateRedirect(redirectTo);
        await supabase.auth.signOut();
      }
    } catch {
      // Provider failures are not successful confirmations.
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.search = "";
  redirectTo.searchParams.set("error", "confirmation_failed");
  redirectTo.searchParams.set("next", next);
  return privateRedirect(redirectTo);
}
