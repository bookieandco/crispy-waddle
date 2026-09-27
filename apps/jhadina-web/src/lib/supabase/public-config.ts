/**
 * Public Supabase bootstrap configuration for the canonical SWLC Jhadina runtime.
 *
 * Supabase publishable keys are intentionally low-privilege browser identifiers;
 * database access remains constrained by Auth + RLS. Environment variables always
 * win, so rotating the project/key does not require a source change.
 *
 * Never place a secret/service-role key in this module.
 */
const FALLBACK_SUPABASE_URL = "https://kqbkaozfjubkjevdfvic.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FVcYgRA8XOS5ZvePFgU4GQ_vdWTTvA7";

function value(input: string | undefined): string | undefined {
  const normalized = input?.trim();
  return normalized ? normalized : undefined;
}

export function getSupabasePublicConfig() {
  const server = typeof window === "undefined";
  const url =
    value(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    (server ? value(process.env.SUPABASE_URL) : undefined) ||
    FALLBACK_SUPABASE_URL;
  const publishableKey =
    value(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    value(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (server ? value(process.env.SUPABASE_PUBLISHABLE_KEY) : undefined) ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("SUPABASE_PUBLIC_CONFIG_UNAVAILABLE");
  }
  if (!publishableKey.startsWith("sb_publishable_") && !publishableKey.startsWith("eyJ")) {
    throw new Error("SUPABASE_PUBLIC_KEY_INVALID");
  }
  return Object.freeze({ url, publishableKey });
}
