import { describe, expect, it, vi } from "vitest";
import { inspectMusicLiveReadiness } from "./music-live-readiness";

describe("authenticated Music dependency canary", () => {
  it("fails closed for missing storage, migration and source rights without revealing errors", async () => {
    const p = {
      catalog: vi.fn(async () => true),
      checkpoint: vi.fn(async () => { throw new Error("SQL secret should never leak"); }),
      ownedStorage: vi.fn(async () => false),
      grantedSources: vi.fn(async () => 0),
    };
    const result = await inspectMusicLiveReadiness("alice", p);
    expect(result.status).toBe("needs_configuration");
    expect(result.livePlaybackCertified).toBe(false);
    expect(result.missing).toEqual([
      "music_checkpoint_migration","owned_audio_bucket_or_read_policy","authorized_audio_source",
    ]);
    expect(JSON.stringify(result)).not.toContain("SQL secret");
    expect(p.catalog).toHaveBeenCalledWith("alice");
  });
  it("never equates successful probes with actual playback certification", async () => {
    const yes = {
      catalog: async () => true, checkpoint: async () => true,
      ownedStorage: async () => true, grantedSources: async () => 1,
    };
    const result = await inspectMusicLiveReadiness("alice", yes);
    expect(result.status).toBe("environment_ready_for_playback_drill");
    expect(result.livePlaybackCertified).toBe(false);
    await expect(inspectMusicLiveReadiness("", yes)).rejects.toThrow("Authenticated");
  });
});
