import type { SupabaseClient } from "@supabase/supabase-js";
import { isVerifiedPersonalOwner } from "./personal-owner";

export function safeAuthNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/";
  return value;
}

/** Only public, documented error codes are displayed. Never expose credentials, challenge IDs, provider error strings or tokens. */
const PUBLIC_PASSKEY_CODES = new Set([
 "passkey_disabled","webauthn_credential_exists","webauthn_challenge_expired",
 "webauthn_challenge_not_found","webauthn_credential_not_found","webauthn_verification_failed",
 "ERROR_INVALID_RP_ID","ERROR_INVALID_DOMAIN","ERROR_CEREMONY_ABORTED",
 "PASSKEY_SESSION_UNVERIFIED","PASSKEY_OWNER_REQUIRED","PASSKEY_SIGN_IN_REQUIRED",
 "PASSKEY_REGISTRATION_UNVERIFIED","PASSKEY_METHOD_UNAVAILABLE",
 "NotAllowedError","SecurityError",
]);
export function passkeyDiagnosticCode(error: unknown): string {
 const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
 const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
 const message = error instanceof Error ? error.message : "";
 const candidate = [code, message, name].find(value => PUBLIC_PASSKEY_CODES.has(value));
 return candidate ?? "passkey_unknown_error";
}

export function passkeyErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (code === "passkey_disabled") return "Passkey sign-in is not enabled yet. Use another sign-in method for now.";
  if (code === "webauthn_credential_exists") return "This passkey is already registered. You can use it to sign in.";
  if (code === "webauthn_challenge_expired" || code === "webauthn_challenge_not_found")
    return "This Face ID request expired or was already used. Try once more, or unlock with your owner email link below.";
  if (code === "webauthn_credential_not_found")
    return "This passkey is not registered to Jhadina here. Unlock with your owner email link, then set up Face ID on this exact site address.";
  if (code === "webauthn_verification_failed")
    return "Jhadina could not verify the passkey after the device prompt. Unlock once with your owner email link, then check Face ID enrollment for this exact site address.";
  if (code === "ERROR_INVALID_RP_ID" || code === "ERROR_INVALID_DOMAIN" || name === "SecurityError")
    return "This website address does not match the passkey's allowed site. Unlock with your owner email link, then set up Face ID from this address.";
  if (name === "NotAllowedError" || code === "ERROR_CEREMONY_ABORTED") return "Passkey request cancelled or timed out. You can try again.";
  if (error instanceof Error && error.message === "PASSKEY_OWNER_REQUIRED") return "This passkey is not associated with the verified Jhadina owner account.";
  if (error instanceof Error && error.message === "PASSKEY_SESSION_UNVERIFIED")
    return "Face ID did not establish a complete verified owner session. Unlock with your owner email link instead.";
  if (error instanceof Error && error.message === "PASSKEY_METHOD_UNAVAILABLE")
    return "Face ID sign-in is unavailable in this browser build. Use the owner email link below.";
  return "Passkey sign-in did not complete. Use the owner email link below to enter Jhadina without repeating Face ID.";

}

type PasskeyAuth = Pick<SupabaseClient["auth"], "getUser" | "registerPasskey" | "signInWithPasskey" | "signOut">;

export async function performPasskey(auth: PasskeyAuth, mode: "signin" | "register"): Promise<void> {
  if (mode === "register") {
    const { data, error } = await auth.getUser();
    if (error || !isVerifiedPersonalOwner(data.user)) throw new Error("PASSKEY_SIGN_IN_REQUIRED");
    const result = await auth.registerPasskey();
    if (result.error) throw result.error;
    if (!result.data?.id) throw new Error("PASSKEY_REGISTRATION_UNVERIFIED");
    return;
  }
  if (typeof auth.signInWithPasskey !== "function") throw new Error("PASSKEY_METHOD_UNAVAILABLE");
  const result = await auth.signInWithPasskey();
  if (result.error) throw result.error;
  if (!result.data?.session || !result.data.user || result.data.session.user.id !== result.data.user.id) {
    await auth.signOut();
    throw new Error("PASSKEY_SESSION_UNVERIFIED");
  }
  if (!isVerifiedPersonalOwner(result.data.user)) {
    await auth.signOut();
    throw new Error("PASSKEY_OWNER_REQUIRED");
  }
}
