import type { User } from "@supabase/supabase-js";

/** Public identity selector only. Not a secret, entitlement, or sufficient auth proof. */
export const JHADINA_PERSONAL_OWNER_EMAIL = "dorianmorris8@icloud.com" as const;

/** A fixed email allowlist; never trust a display name or user_metadata for admission. */
export function isPersonalOwnerEmail(email: unknown): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === JHADINA_PERSONAL_OWNER_EMAIL;
}

/** Must be a provider-verified Auth user, not just a submitted or JWT display email. */
export function isVerifiedPersonalOwner(user: Pick<User, "id" | "email" | "email_confirmed_at" | "is_anonymous"> | null | undefined): boolean {
  return Boolean(
    user &&
    typeof user.id === "string" &&
    user.id.length > 0 &&
    isPersonalOwnerEmail(user.email) &&
    user.email_confirmed_at &&
    user.is_anonymous !== true,
  );
}
