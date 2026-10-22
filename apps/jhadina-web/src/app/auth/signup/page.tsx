import Link from "next/link";
import { signup } from "@/app/login/actions";
import { JHADINA_PERSONAL_OWNER_EMAIL } from "@/lib/auth/personal-owner";

export default function NewJhadinaAccountPage() {
  return (
    <main style={{ maxWidth: 460, margin: "48px auto", padding: 24 }}>
      <h1>Activate your private Jhadina account</h1>
      <p>Only the designated iCloud owner email is admitted. Verify access to that inbox before you add Face ID. You may use the one-time email link on the sign-in page instead of creating a password.</p>
      <form action={signup} style={{ display: "grid", gap: 14, marginTop: 24 }}>
        <input type="hidden" name="next" value="/" />
        <label style={{ display: "grid", gap: 6 }}>
          Email address
          <input name="email" type="email" readOnly value={JHADINA_PERSONAL_OWNER_EMAIL} required maxLength={254} style={{ minHeight: 48, padding: 12 }} />
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
