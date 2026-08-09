import { login, signup } from "./actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = first(params.error);
  const message = first(params.message);
  const next = first(params.next) ?? "/";

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>Sign in to Jhadina</h1>
      <p>Your Jhadina workspace is protected by Supabase Auth.</p>

      {error && <p role="alert">Authentication error: {error.replaceAll("_", " ")}</p>}
      {message && <p role="status">{message.replaceAll("_", " ")}</p>}

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
    </main>
  );
}
