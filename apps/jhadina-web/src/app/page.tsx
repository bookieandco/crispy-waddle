import { createClient } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main style={{ maxWidth: 900, margin: "60px auto", padding: 24 }}>
      <h1>Jhadina</h1>
      <p>Protected Command Center.</p>
      <p>Signed in as: {data?.claims?.email ?? "authenticated user"}</p>
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
