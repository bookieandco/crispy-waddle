import Link from "next/link";
import { PasskeyAction } from "./passkey-action";
import { safeAuthNext } from "@/lib/auth/passkey";
import { login, sendOwnerSignInLink } from "./actions";
import { JHADINA_PERSONAL_OWNER_EMAIL } from "@/lib/auth/personal-owner";
import { authPageErrorMessage } from "@/lib/auth/login-outage";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedPersonalOwner } from "@/lib/auth/personal-owner";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams = {} }: LoginPageProps) {
  const error = first(searchParams.error);
  const message = first(searchParams.message);
  const requestedNext = safeAuthNext(first(searchParams.next));
  const next = requestedNext === "/login" || requestedNext.startsWith("/login?") ? "/" : requestedNext;
  const settingUpPasskey = next === "/settings/security";

  // Reusing a valid owner cookie must never start a second Face ID/OTP flow.
  // A failed Auth lookup must still fail closed and show the login form.
  try {
    const supabase = await createClient();
    const { data, error: sessionError } = await supabase.auth.getUser();
    if (!sessionError && isVerifiedPersonalOwner(data.user)) redirect(next);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error &&
        String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    // No verified owner session: show the ordinary sign-in choices.
  }


  return (
    <main className="jh-page"><div className="jh-auth-card">
      <p className="jh-eyebrow">Your private workspace</p>
      <h1>{settingUpPasskey ? "Sign in to set up a passkey" : "Sign in to Jhadina"}</h1>
      <p>Welcome back. Unlock with your owner passkey. To set up Face ID on a new device, verify your existing owner account using a one-time email link.</p>
      {error && <p role="alert" style={{ color: "#a12c2c" }}>{authPageErrorMessage(error)}</p>}
      {message && <p role="status">{message === "check_email" ? "Check your email for the confirmation link." : message === "password_changed" ? "Password updated. Sign in with your new password." : "Your request has been received."}</p>}

      <PasskeyAction next={next} />
      <section id="owner-email-signin" aria-label="Email sign-in recovery" style={{ display: "grid", gap: 12, marginTop: 20, padding: 16, border: "1px solid #54765d", borderRadius: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Face ID not working?</h2>
        <p style={{ margin: 0 }}>Use one verified email link to enter your workspace. Once inside, open Security Settings to add or replace the Apple Passwords passkey on this device.</p>
        <form action={sendOwnerSignInLink} style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="next" value={next} />
          <label style={{ display: "grid", gap: 6 }}>
            Owner email
            <input name="email" type="email" autoComplete="email" readOnly value={JHADINA_PERSONAL_OWNER_EMAIL} style={{ padding: 13, minHeight: 48, width: "100%" }} />
          </label>
          <button type="submit" style={{ padding: "12px 20px", minHeight: 50, borderRadius: 12, fontWeight: 700 }}>Email my one-time sign-in link</button>
        </form>
        <p style={{ margin: 0, fontSize: 14 }}>If an email limit is reached, use your existing password below rather than requesting more links.</p>
      </section>
      <details style={{ marginTop: 22 }}>
        <summary style={{ cursor: "pointer", padding: "8px 0" }}>Use an existing password (optional recovery)</summary>
      <form action={login} style={{ display: "grid", gap: 14, marginTop: 24 }}>
        <input type="hidden" name="next" value={next} />
        <label style={{ display: "grid", gap: 6 }}>
          Email address
          <input name="email" type="email" autoComplete="email" readOnly value={JHADINA_PERSONAL_OWNER_EMAIL} required style={{ padding: 13, minHeight: 48, width: "100%" }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Password
          <input name="password" type="password" autoComplete="current-password" minLength={8} required style={{ padding: 13, minHeight: 48, width: "100%" }} />
        </label>
        <button type="submit" style={{ minHeight: 50, padding: "12px 20px", borderRadius: 12, fontWeight: 700 }}>Sign in with password</button>
      </form>
      </details>


      {!settingUpPasskey && <p style={{ marginTop: 18 }}>
        Already signed in? <Link href="/settings/security">Set up a passkey on your device</Link> after email sign-in.
      </p>}

      <p style={{ marginTop: 24 }}>
        Have an account but cannot sign in? <Link href="/auth/recover">Set or reset your password</Link>.
      </p>
      <p style={{ marginTop: 24 }}>If this page is behind a Vercel sign-in screen, use your Vercel project account first. That is separate from Jhadina.</p>
    </div></main>
  );
}
