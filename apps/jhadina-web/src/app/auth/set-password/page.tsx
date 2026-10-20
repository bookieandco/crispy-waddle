import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authPageErrorMessage } from "@/lib/auth/login-outage";
import { setNewPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({ searchParams = {} }: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) redirect("/auth/recover?error=password_session_required");
  const code = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error;
  return (
    <main style={{ maxWidth: 460, margin: "48px auto", padding: 24 }}>
      <h1>Choose your Jhadina password</h1>
      <p>Your email link has been verified. Choose a new password to access your existing account.</p>
      {code && <p role="alert">{authPageErrorMessage(code)}</p>}
      <form action={setNewPassword} style={{ display: "grid", gap: 14, marginTop: 22 }}>
        <label style={{ display: "grid", gap: 6 }}>New password (at least 8 characters)
          <input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required style={{ minHeight: 48, padding: 12 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Confirm new password
          <input type="password" name="confirmation" autoComplete="new-password" minLength={8} maxLength={128} required style={{ minHeight: 48, padding: 12 }} />
        </label>
        <button type="submit" style={{ minHeight: 50 }}>Save my new password</button>
      </form>
      <p style={{ marginTop: 20 }}>If your link has expired, <Link href="/auth/recover">request a new one</Link>.</p>
    </main>
  );
}
