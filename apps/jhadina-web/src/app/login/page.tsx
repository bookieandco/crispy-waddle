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
  const next = safeAuthNext(first(searchParams.next));
  const settingUpPasskey = next === "/settings/security";
  // A validated owner session has already unlocked this browser/origin.
  // Never force another passkey, OTP or password ceremony merely because
  // the user visited /login directly or followed an old email link.
  let sessionIsVerifiedOwner = false;
  try {
    const supabase = await createClient();
    const { data, error: sessionError } = await supabase.auth.getUser();
    sessionIsVerifiedOwner = !sessionError && isVerifiedPersonalOwner(data.user);
  } catch {
    // An auth outage never creates an anonymous build-mode shortcut.
  }
  if (sessionIsVerifiedOwner) redirect(next);


  return (
    <main className="jh-page"><div className="jh-auth-card">
      <p className="jh-eyebrow">Your private workspace</p>
      <h1>{settingUpPasskey ? "Sign in to set up a passkey" : "Sign in to Jhadina"}</h1>
      <p>Welcome back. Unlock with your owner passkey. To set up Face ID on a new device, verify your existing owner account using a one-time email link.</p>
      {error && <p role="alert" style={{ color: "#a12c2c" }}>{authPageErrorMessage(error)}</p>}
      {message && <p role="status">{message === "check_email" ? "Check your email for the confirmation link." : message === "password_changed" ? "Password updated. Sign in with your new password." : "Your request has been received."}</p>}

      <PasskeyAction next={next} />
      <p style={{ marginTop: 4, fontSize: 14 }}>On this device and site address, a valid owner session will take you straight back to your workspace without signing in again. A new browser, expired session, or different preview address may require Face ID.</p>
      <details open={settingUpPasskey}><summary>First visit · Set up Face ID</summary>
      <section style={{ display: "grid", gap: 14, marginTop: 24, padding: 16, border: "1px solid #54765d", borderRadius: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>First-time access</h2>
        <p style={{ margin: 0 }}>One verified email link can open the exact Jhadina page you requested. Add Face ID in <Link href="/settings/security">Security Settings</Link> when convenient; that setup is not required to view your current build page. Avoid repeatedly requesting email links if Supabase reports a temporary rate limit.</p>
        <form action={sendOwnerSignInLink} style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="next" value={next} />
          <label style={{ display: "grid", gap: 6 }}>
            Owner email
            <input name="email" type="email" autoComplete="email" readOnly value={JHADINA_PERSONAL_OWNER_EMAIL} style={{ padding: 13, minHeight: 48, width: "100%" }} />
          </label>
          <button type="submit" style={{ padding: "12px 20px", minHeight: 50, borderRadius: 12, fontWeight: 700 }}>Email my one-time sign-in link</button>
        </form>
      </section>
      </details>
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
