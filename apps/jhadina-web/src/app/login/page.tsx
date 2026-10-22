import Link from "next/link";
import { PasskeyAction } from "./passkey-action";
import { safeAuthNext } from "@/lib/auth/passkey";
import { login, sendOwnerSignInLink } from "./actions";
import { JHADINA_PERSONAL_OWNER_EMAIL } from "@/lib/auth/personal-owner";
import { authPageErrorMessage } from "@/lib/auth/login-outage";

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function LoginPage({ searchParams = {} }: LoginPageProps) {
  const error = first(searchParams.error);
  const message = first(searchParams.message);
  const next = safeAuthNext(first(searchParams.next));
  const settingUpPasskey = next === "/settings/security";

  return (
    <main className="jh-page"><div className="jh-auth-card">
      <p className="jh-eyebrow">Your private workspace</p>
      <h1>{settingUpPasskey ? "Sign in to set up a passkey" : "Sign in to Jhadina"}</h1>
      <p>Welcome back. Unlock with your owner passkey. To set up Face ID on a new device, verify your existing owner account using a one-time email link.</p>
      {error && <p role="alert" style={{ color: "#a12c2c" }}>{authPageErrorMessage(error)}</p>}
      {message && <p role="status">{message === "check_email" ? "Check your email for the confirmation link." : message === "password_changed" ? "Password updated. Sign in with your new password." : "Your request has been received."}</p>}

      <PasskeyAction next={next} />
      <details open={settingUpPasskey}><summary>First visit · Set up Face ID</summary>
      <section style={{ display: "grid", gap: 14, marginTop: 24, padding: 16, border: "1px solid #54765d", borderRadius: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>First-time access</h2>
        <p style={{ margin: 0 }}>Use one verified email link to enter, then add Face ID in Security Settings. If Supabase has temporarily reached its email quota, wait before requesting another; existing password sign-in remains available below.</p>
        <form action={sendOwnerSignInLink} style={{ display: "grid", gap: 12 }}>
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
