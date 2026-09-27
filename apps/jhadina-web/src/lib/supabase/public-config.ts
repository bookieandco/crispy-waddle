/**
 * Browser-safe Supabase configuration for the canonical Jhadina project.
 *
 * Both values below are public by design. They grant no service-role authority;
 * database access still depends on Supabase Auth + RLS.
 *
 * Deployment environment values always take precedence so previews or future
 * project migrations can override the canonical fallback without code changes.
 */
const JHADINA_SUPABASE_URL = "https://kqbkaozfjubkjevdfvic.supabase.co";
const JHADINA_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_FVcYgRA8XOS5ZvePFgU4GQ_vdWTTvA7";

export interface PublicSupabaseConfig {
  url: string;
  key: string;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    JHADINA_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    JHADINA_SUPABASE_PUBLISHABLE_KEY;

  return { url, key };
}
