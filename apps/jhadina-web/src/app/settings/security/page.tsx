import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasskeyAction } from "../../login/passkey-action";
import { isVerifiedPersonalOwner } from "@/lib/auth/personal-owner";

export const dynamic = "force-dynamic";

export default async function SecuritySettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !isVerifiedPersonalOwner(data.user)) redirect("/login?next=%2Fsettings%2Fsecurity");
  return (
    <main style={{ maxWidth: 520, margin: "48px auto", padding: "24px 24px 100px" }}>
      <h1>Sign-in & security</h1>
      <p>After verifying your owner email, add a passkey to sign in with Face ID or your device passcode. Your biometric information never reaches Jhadina.</p>
      <PasskeyAction mode="register" />
      <p>Your device controls whether it uses biometrics or an unlock code. Keep access to your existing sign-in method for account recovery.</p>
      <Link href="/ask-jhadina">Back to Jhadina</Link>
    </main>
  );
}
