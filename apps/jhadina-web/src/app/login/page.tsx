import { PasskeyAction } from "./passkey-action";
import { safeAuthNext } from "@/lib/auth/passkey";
import { login, signup } from "./actions";

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
        : "Welcome back. Use your passkey to open your workspace."}</p>

      {error && <p role="alert">Authentication error: {error.replaceAll("_", " ")}</p>}
      {message && <p role="status">{message.replaceAll("_", " ")}</p>}

      <PasskeyAction next={next} />
      {!settingUpPasskey && <p><a href="/login?next=%2Fsettings%2Fsecurity">Set up a passkey</a> — sign in once, then add it on your device.</p>}
      <details open={settingUpPasskey || Boolean(error || message)}>
        <summary>{settingUpPasskey ? "Sign in to add your passkey" : "Other sign-in options"}</summary>
      <form style={{ display: "grid", gap: 12 }}>
        <input type="hidden" name="next" value={next} />
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <button formAction={login} type="submit">
            Sign in
          </button>
          <button formAction={signup} type="submit">
            Create account
          </button>
        </div>
      </form>
      </details>
    </main>
  );
}
