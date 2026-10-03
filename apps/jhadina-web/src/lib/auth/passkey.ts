import type { SupabaseClient } from "@supabase/supabase-js";

export function safeAuthNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/";
  return value;
}

export function passkeyErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (code === "passkey_disabled") return "Passkey sign-in is not enabled yet. Use another sign-in method for now.";
  if (code === "webauthn_credential_exists") return "This passkey is already registered. You can use it to sign in.";
  if (code === "webauthn_challenge_expired") return "The request expired. Please try again.";
  if (code === "webauthn_credential_not_found") return "No matching passkey was found. Sign in once to set one up.";
  if (name === "NotAllowedError" || code === "ERROR_CEREMONY_ABORTED") return "Passkey request cancelled or timed out. You can try again.";
  return "Could not verify your passkey. Please try again or use another sign-in method.";
}

type PasskeyAuth = Pick<SupabaseClient["auth"], "getUser" | "registerPasskey" | "signInWithPasskey">;

export async function performPasskey(auth: PasskeyAuth, mode: "signin" | "register"): Promise<void> {
  if (mode === "register") {
    const { data, error } = await auth.getUser();
    if (error || !data.user || data.user.is_anonymous) throw new Error("PASSKEY_SIGN_IN_REQUIRED");
    const result = await auth.registerPasskey();
    if (result.error) throw result.error;
    if (!result.data?.id) throw new Error("PASSKEY_REGISTRATION_UNVERIFIED");
    return;
  }
  const result = await auth.signInWithPasskey();
  if (result.error) throw result.error;
  if (!result.data?.session || !result.data.user || result.data.session.user.id !== result.data.user.id) {
    throw new Error("PASSKEY_SESSION_UNVERIFIED");
  }
}
