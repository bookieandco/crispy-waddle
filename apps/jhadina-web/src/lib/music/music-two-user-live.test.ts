import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { verifyTwoUserMusicReadIsolation } from "./music-two-user-readonly";
import type { MusicTenantFixture } from "./music-two-user-readonly";

/**
 * Runs ONLY when explicitly invoked with MUSIC_RLS_LIVE=1 after SWLC recovery.
 * Never uses a service-role token, never seeds data, and never mutates rows.
 * `pnpm --filter @jhadina/jhadina-web test music-two-user-live`
 */
describe.runIf(process.env.MUSIC_RLS_LIVE === "1")(
  "live two independently authenticated accounts cannot read one another's music",
  () => {
    it("requires seeded owner-positive fixtures and cross-account denials", async () => {
      const need = (name: string) => {
        const value = process.env[name]?.trim();
        if (!value) throw new Error(`Missing required Music RLS fixture configuration: ${name}`);
        return value;
      };
      const url = need("MUSIC_RLS_URL");
      const publicKey = need("MUSIC_RLS_PUBLISHABLE_KEY");
      const makeFixture = (suffix: "A" | "B"): MusicTenantFixture => ({
        userId: need(`MUSIC_RLS_USER_${suffix}_ID`),
        trackId: need(`MUSIC_RLS_USER_${suffix}_TRACK_ID`),
        checkpointTrackId: need(`MUSIC_RLS_USER_${suffix}_CHECKPOINT_TRACK_ID`),
        privateAudioObjectPath: need(`MUSIC_RLS_USER_${suffix}_STORAGE_PATH`),
      });
      const makeUser = (suffix: "A" | "B") => {
        const jwt = need(`MUSIC_RLS_USER_${suffix}_JWT`);
        const client = createClient(url, publicKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        return { client, jwt, fixture: makeFixture(suffix) };
      };
      const result = await verifyTwoUserMusicReadIsolation(makeUser("A"), makeUser("B"));
      expect(result.usersIndependentlyVerified).toBe(true);
      expect(result.crossUserCatalogDenied).toBe(true);
      expect(result.crossUserCheckpointDenied).toBe(true);
      expect(result.crossUserStorageDenied).toBe(true);
      expect(result.includesWriteAuthorizationProof).toBe(false);
      expect(result.livePlaybackCertified).toBe(false);
    }, 60000);
  },
);
