import Link from "next/link";
import { PasskeyAction } from "./passkey-action";
import { safeAuthNext } from "@/lib/auth/passkey";
import { login } from "./actions";
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
    <main style={{ maxWidth: 460, margin: "48px auto", padding: "24px 20px 72px" }}>
      <h1>{settingUpPasskey ? "Sign in to set up a passkey" : "Sign in to Jhadina"}</h1>
      <p>Use your existing Jhadina email and password. A passkey is optional — you do not need one to sign in.</p>
      {error && <p role="alert" style={{ color: "#a12c2c" }}>{authPageErrorMessage(error)}</p>}
      {message && <p role="status">{message === "check_email" ? "Check your email for the confirmation link." : message === "password_changed" ? "Password updated. Sign in with your new password." : "Your request has been received."}</p>}

      <form action={login} style={{ display: "grid", gap: 14, marginTop: 24 }}>
        <input type="hidden" name="next" value={next} />
        <label style={{ display: "grid", gap: 6 }}>
          Email address
          <input name="email" type="email" autoComplete="email" inputMode="email" required style={{ padding: 13, minHeight: 48, width: "100%" }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Password
          <input name="password" type="password" autoComplete="current-password" minLength={8} required style={{ padding: 13, minHeight: 48, width: "100%" }} />
        </label>
        <button type="submit" style={{ minHeight: 50, padding: "12px 20px", borderRadius: 12, fontWeight: 700 }}>
          Sign in with email
        </button>
      </form>

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: "pointer", padding: "8px 0" }}>Use a passkey instead (optional)</summary>
        <PasskeyAction next={next} />
      </details>

      {!settingUpPasskey && <p style={{ marginTop: 18 }}>
        Already signed in? <Link href="/settings/security">Set up a passkey on your device</Link> after email sign-in.
      </p>}

      <p style={{ marginTop: 24 }}>
        Have an account but cannot sign in? <Link href="/auth/recover">Set or reset your password</Link>.
      </p>
      <p style={{ marginTop: 16 }}>
        New to Jhadina? <Link href="/auth/signup">Create an account and choose a password</Link>.
      </p>
      <p style={{ marginTop: 24 }}>If this page is behind a Vercel sign-in screen, use your Vercel project account first. That is separate from Jhadina.</p>
    </main>
  );
}
