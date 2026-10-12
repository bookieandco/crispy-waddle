import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { SupabaseMusicRepository } from "./supabase-music-repository";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import { MusicAuthRequiredError, MusicBackendUnavailableError } from "./music-request-scope";

/** The native app supplies a Supabase JWT, never a user ID or service key.
 * PostgREST and Storage requests are performed with exactly that JWT.
 */
export async function authorizedNativeMusicScope(req: NextRequest): Promise<{
  userId: string;
  db: SupabaseClient;
  repository: SupabaseMusicRepository;
}> {
  const authorization = req.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_~+./=-]+)$/.exec(authorization);
  if (!match || match[1].length > 8192) throw new MusicAuthRequiredError();
  const { url, publishableKey } = getSupabasePublicConfig();
  const db = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  let identity;
  try { identity = await db.auth.getUser(match[1]); }
  catch { throw new MusicBackendUnavailableError(); }
  if (identity.error || !identity.data.user?.id) throw new MusicAuthRequiredError();
  const userId = identity.data.user.id;
  return { userId, db, repository: new SupabaseMusicRepository(db) };
}
