"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authConfirmationOrigin } from "@/lib/auth/login-outage";
import { validRecoveryEmail } from "@/lib/auth/password-recovery";

/** User-requested only: we never trigger recovery emails automatically. */
export async function requestPasswordReset(formData: FormData) {
  const email = validRecoveryEmail(formData.get("email"));
  if (!email) redirect("/auth/recover?error=recovery_email_required");

  const origin = authConfirmationOrigin({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
  });

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email!, {
      redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/auth/set-password")}`,
    });
    if (error?.status === 429) redirect("/auth/recover?error=recovery_rate_limited");
    // Never reveal whether an email is registered.
    if (error && error.status && error.status >= 500) redirect("/auth/recover?error=recovery_unavailable");
  } catch (error) {
    // Next.js redirect throws and must be allowed to propagate.
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    redirect("/auth/recover?error=recovery_unavailable");
  }
  redirect("/auth/recover?sent=1");
}
