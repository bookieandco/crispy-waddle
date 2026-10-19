"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { safeAuthNext } from "@/lib/auth/passkey";
import { validateNewPassword } from "@/lib/auth/password-recovery";
import { authConfirmationOrigin, authFailureCode, type AuthFailureCode } from "@/lib/auth/login-outage";

function loginErrorLocation(code: string, next: string) {
  return `/login?error=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeAuthNext(formData.get("next"));

  if (!email || !password) {
    redirect(loginErrorLocation("missing_credentials", next));
  }

  let failure: AuthFailureCode | undefined;
  try {
    const supabase = await createClient();
    const response = await supabase.auth.signInWithPassword({ email, password });
    if (response.error) failure = authFailureCode(response.error, "invalid_credentials");
    else if (!response.data?.user || !response.data?.session ||
      response.data.session.user.id !== response.data.user.id) failure = "session_not_established";
  } catch {
    // Transport/DB/auth-startup errors are not necessarily bad passwords.
    // Avoid leaking provider payloads or treating an outage as success.
    failure = "service_unavailable";
  }

  if (failure) redirect(loginErrorLocation(failure, next));
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeAuthNext(formData.get("next"));

  const validation = validateNewPassword(password, formData.get("confirmation"));
  if (!email || validation) {
    redirect(loginErrorLocation(validation ?? "signup_requirements", next));
  }

  const origin = authConfirmationOrigin({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
  });
  let failure: AuthFailureCode | undefined;
  try {
    const supabase = await createClient();
    const response = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    if (response.error) failure = authFailureCode(response.error, "signup_failed");
    else if (response.data?.session && response.data?.user &&
      response.data.session.user.id === response.data.user.id) {
      // Projects with email auto-confirm enabled create the session immediately.
      // Avoid telling the owner to look for a confirmation email that will not come.
      revalidatePath("/", "layout");
      redirect(next);
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    failure = "service_unavailable";
  }

  if (failure) redirect(loginErrorLocation(failure, next));
  redirect(`/login?message=check_email&next=${encodeURIComponent(next)}`);
}
