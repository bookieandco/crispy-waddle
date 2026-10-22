/**
 * Strictly parse the owner's emailed Supabase magic link inside the current
 * wallet-capable browser, without navigating through Safari or trusting an
 * arbitrary email-supplied redirect URL.
 *
 * This is a token extraction helper, NOT proof of owner identity.
 * The caller MUST verify the token with Supabase and check the verified user.
 */
export type EmailMagicLinkToken = Readonly<{
  token_hash: string;
  type: "magiclink" | "email";
}>;

export function parseEmailedMagicLink(value: string, expectedSupabaseUrl: string): EmailMagicLinkToken {
  if (typeof value !== "string" || value.length > 4096) throw new Error("EMAIL_MAGIC_LINK_INVALID");
  const raw = value.trim();
  let link: URL;
  let trusted: URL;
  try {
    link = new URL(raw);
    trusted = new URL(expectedSupabaseUrl);
  } catch {
    throw new Error("EMAIL_MAGIC_LINK_INVALID");
  }
  if (link.protocol !== "https:" || trusted.protocol !== "https:" ||
      link.origin !== trusted.origin || link.username || link.password ||
      link.pathname !== "/auth/v1/verify" || link.hash ||
      link.searchParams.has("access_token") || link.searchParams.has("refresh_token")) {
    throw new Error("EMAIL_MAGIC_LINK_UNTRUSTED");
  }
  const token = link.searchParams.get("token");
  const type = link.searchParams.get("type");
  if (!token || !/^[A-Za-z0-9._~-]{16,2048}$/.test(token) ||
      (type !== "magiclink" && type !== "email") ||
      link.searchParams.getAll("token").length !== 1 ||
      link.searchParams.getAll("type").length !== 1) {
    throw new Error("EMAIL_MAGIC_LINK_INVALID");
  }
  return Object.freeze({ token_hash: token, type });
}
