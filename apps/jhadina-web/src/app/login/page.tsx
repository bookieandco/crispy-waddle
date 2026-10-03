import Link from "next/link";
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

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>Sign in to Jhadina</h1>
      <p>Welcome back. Use your passkey to open your workspace.</p>

      {error && <p role="alert">Authentication error: {error.replaceAll("_", " ")}</p>}
      {message && <p role="status">{message.replaceAll("_", " ")}</p>}

      <PasskeyAction next={next} />
      <p><Link href="/settings/security">Set up a passkey</Link> — sign in once, then add it on your device.</p>
      <details open={Boolean(error || message)}>
        <summary>Other sign-in options</summary>
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
