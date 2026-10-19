import Link from "next/link";
import { signup } from "@/app/login/actions";

export default function NewJhadinaAccountPage() {
  return (
    <main style={{ maxWidth: 460, margin: "48px auto", padding: 24 }}>
      <h1>Create your Jhadina account</h1>
      <p>Use this form only if you do not already have an account. Create an email and password, then verify your email if asked.</p>
      <form action={signup} style={{ display: "grid", gap: 14, marginTop: 24 }}>
        <input type="hidden" name="next" value="/" />
        <label style={{ display: "grid", gap: 6 }}>
          Email address
          <input name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} style={{ minHeight: 48, padding: 12 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Create password (at least 8 characters)
          <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required style={{ minHeight: 48, padding: 12 }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Confirm password
          <input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required style={{ minHeight: 48, padding: 12 }} />
        </label>
        <button type="submit" style={{ minHeight: 50 }}>Create Jhadina account</button>
      </form>
      <p style={{ marginTop: 24 }}>Already have an account? <Link href="/auth/recover">Set or reset its password</Link> instead.</p>
      <p><Link href="/login">Back to sign-in</Link></p>
    </main>
  );
}
