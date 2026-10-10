import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const baseSchema = readFileSync(new URL("../sql/001_music_core.sql", import.meta.url), "utf8");
const admission = readFileSync(new URL("../sql/MUSIC-SECURITY-ADMISSION-2026-10-09.sql", import.meta.url), "utf8");
const storage = readFileSync(new URL("../sql/MUSIC-STORAGE-ADMISSION-2026-10-09.sql", import.meta.url), "utf8");
const catalogTables = [
  "music_sources", "music_artists", "music_albums", "music_tracks", "music_playlists",
  "music_assets", "music_artwork", "music_lyrics", "music_listening_events",
];

describe("Music RLS migration source invariants (not a live database certification)", () => {
  it("creates the base schema atomically with RLS enabled before commit", () => {
    expect(baseSchema.trimStart().startsWith("-- MUSIC SECURITY:")).toBe(true);
    expect(baseSchema).toMatch(/begin;[\s\S]*commit;/i);
    for (const table of catalogTables) {
      expect(baseSchema).toContain(`alter table public.${table} enable row level security;`);
      expect(baseSchema).toContain(`alter table public.${table} force row level security;`);
    }
    expect(baseSchema.trimEnd().endsWith("commit;")).toBe(true);
  });
  it("enables and forces RLS on every exposed catalog table", () => {
    for (const table of catalogTables) {
      expect(admission).toContain(`alter table public.${table} enable row level security;`);
      expect(admission).toContain(`alter table public.${table} force row level security;`);
    }
    expect(admission).toContain("user_id = (select auth.uid())::text");
    expect(admission).toContain("from anon, public");
  });
  it("keeps creation of playable source permissions and approved audio assets server-only", () => {
    expect(admission).toContain("authorized = false");
    expect(admission).toContain("grant select on public.music_assets to authenticated;");
    expect(admission).not.toMatch(/grant\s+(?:select\s*,\s*)?insert[^;]*?on\s+public\.music_assets/si);
    expect(admission).not.toMatch(/create\s+policy\s+music_owner_insert\s+on\s+public\.music_assets/si);
  });
  it("requires scoped storage and checkpoint policies without client overwrite permission", () => {
    expect(storage).toContain("bucket_id = 'music-owned'");
    expect(storage).toContain("(storage.foldername(name))[1] = (select auth.uid())::text");
    expect(storage).toContain("music_playback_checkpoints enable row level security;");
    expect(storage).toContain("create policy jhadina_music_owner_read on storage.objects");
    expect(storage).toContain("create policy jhadina_music_owner_create on storage.objects");
    expect(storage).not.toMatch(/create policy jhadina_music_owner_(?:update|delete)/);
  });
});
