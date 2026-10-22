import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { JHADINA_PERSONAL_OWNER_EMAIL } from "@/lib/auth/personal-owner";
import { authPageErrorMessage } from "@/lib/auth/login-outage";

export default function PasswordRecoveryPage({ searchParams = {} }: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const error = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error;
  const sent = searchParams.sent === "1";
  return (
    <main style={{ maxWidth: 460, margin: "48px auto", padding: 24 }}>
      <h1>Set or reset your Jhadina password</h1>
      <p>Already have a Jhadina account but no password, or forgotten it? Enter the email you used for Jhadina. You will need access to that inbox to choose a new password.</p>
      {error && <p role="alert">{authPageErrorMessage(error)}</p>}
      {sent ? <p role="status">If that email is registered, a recovery link has been requested. Check your inbox and spam folder. The link must be opened on a trusted device.</p> : null}
      <form action={requestPasswordReset} style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <label style={{ display: "grid", gap: 6 }}>Your Jhadina email
          <input name="email" type="email" readOnly value={JHADINA_PERSONAL_OWNER_EMAIL} required maxLength={254} style={{ minHeight: 48, padding: 12 }} />
        </label>
        <button type="submit" style={{ minHeight: 50 }}>Email me a password setup link</button>
      </form>
      <p style={{ marginTop: 20 }}>This changes your Jhadina password, not your Vercel account password.</p>
      <Link href="/login">Back to Jhadina sign-in</Link>
    </main>
  );
}
