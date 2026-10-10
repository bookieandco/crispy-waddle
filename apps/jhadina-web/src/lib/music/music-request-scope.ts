import { createClient } from "@/lib/supabase/server";
import { SupabaseMusicRepository } from "@/lib/music/supabase-music-repository";

export class MusicAuthRequiredError extends Error {}
export class MusicBackendUnavailableError extends Error {}

/** The authenticated Supabase SSR session, never an x-user-id request header, owns Music access. */
export async function authenticatedMusicScope() {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error) throw new MusicBackendUnavailableError("Music authentication is temporarily unavailable");
  if (!data.user?.id) throw new MusicAuthRequiredError("Sign in to use your music library");
  return { userId: data.user.id, repository: new SupabaseMusicRepository(db) };
}
