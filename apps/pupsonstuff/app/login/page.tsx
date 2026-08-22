import Link from "next/link";
import { signIn } from "./actions";

export const metadata = { title: "Sign in — PupsonStuff" };

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/admin";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-6 py-12">
      <section className="w-full rounded-xl border border-greige/40 bg-white/70 p-6 shadow-sm">
        <h1 className="font-display text-2xl text-ink">PupsonStuff Admin</h1>
        <p className="mt-1 text-sm text-ink/60">Sign in to manage orders.</p>

        {params.error ? (
          <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        <form action={signIn} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm text-ink">
            Email
            <input
              required
              type="email"
              name="email"
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-greige/50 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>
          <label className="block text-sm text-ink">
            Password
            <input
              required
              type="password"
              name="password"
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-greige/50 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-gold/50"
            />
          </label>
          <button type="submit" className="w-full rounded-md bg-ink px-4 py-2 text-sm font-medium text-white">
            Sign in
          </button>
        </form>

        <p className="mt-5 text-xs text-ink/50">
          Need access? <Link className="underline" href="/">Return to storefront</Link>.
        </p>
      </section>
    </main>
  );
}
