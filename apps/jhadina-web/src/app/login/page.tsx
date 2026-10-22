import { PasskeyAction } from "./passkey-action";
import { safeAuthNext } from "@/lib/auth/passkey";
import { login, sendEmailLink } from "./actions";
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
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>{settingUpPasskey ? "Set up your passkey" : "Sign in to Jhadina"}</h1>
      <p>{settingUpPasskey
        ? "First, sign in with your email and password below. Then you can add a passkey on this device."
        : "Use a one-time email link to sign in. You can add Face ID after your first successful sign-in."}</p>

      {error && <p role="alert">{authPageErrorMessage(error)}</p>}
      {message && <p role="status">{message.replaceAll("_", " ")}</p>}

      <form style={{ display: "grid", gap: 12, margin: "20px 0" }}>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="jh-email-login">Your existing Jhadina email</label>
        <input id="jh-email-login" name="email" type="email" autoComplete="email"
          inputMode="email" autoCapitalize="none" required style={{ minHeight: 48, padding: 12, borderRadius: 10 }} />
        <button formAction={sendEmailLink} type="submit"
          style={{ minHeight: 48, padding: "12px 20px", borderRadius: 12 }}>
          Email me a sign-in link
        </button>
      </form>
      <p style={{ fontSize: 14 }}>
        Open the link from Mail on this iPhone in Safari. Do not create a second account.
        The email link does not authorize posting or connect any social media accounts.
      </p>
      <details open={settingUpPasskey}>
        <summary>Sign in with an existing password</summary>
        <form style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <input type="hidden" name="next" value={next} />
          <label htmlFor="jh-password-email">Email</label>
          <input id="jh-password-email" name="email" type="email" autoComplete="email" required
            style={{ minHeight: 44, padding: 10, borderRadius: 10 }} />
          <label htmlFor="jh-password-field">Password</label>
          <input id="jh-password-field" name="password" type="password"
            autoComplete="current-password" minLength={8} required
            style={{ minHeight: 44, padding: 10, borderRadius: 10 }} />
          <button formAction={login} type="submit" style={{ minHeight: 44 }}>Sign in with password</button>
        </form>
      </details>
      <details style={{ marginTop: 20 }}>
        <summary>Use Face ID or an existing passkey</summary>
        <PasskeyAction next={next} />
      </details>
      {!settingUpPasskey && <p><a href="/login?next=%2Fsettings%2Fsecurity">Set up Face ID after signing in</a></p>}
    </main>
  );
}
