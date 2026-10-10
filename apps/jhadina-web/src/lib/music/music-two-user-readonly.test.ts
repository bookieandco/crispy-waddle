import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyTwoUserMusicReadIsolation } from "./music-two-user-readonly";

const aliceId = "11111111-1111-4111-8111-111111111111";
const bobId = "22222222-2222-4222-8222-222222222222";
function fakeClient(userId: string, compromised = false) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } }, error: null })) },
    from: (name: string) => ({
      select: () => ({
        eq: (field: string, value: string) => ({
          eq: (_field: string, id: string) => ({
            limit: async () => ({ error: null, data:
              value === userId || compromised
                ? [{ [name === "music_tracks" ? "id" : "track_id"]: id }]
                : [],
            }),
          }),
        }),
      }),
    }),
    storage: { from: () => ({
      list: async (folder: string, opts: {search: string}) => ({
        error: null,
        data: folder === userId || compromised ? [{ name: opts.search }] : [],
      }),
    }) },
  } as unknown as SupabaseClient;
}
const fixture = (id: string) => ({
  userId:id,trackId:id+":song",checkpointTrackId:id+":song",
  privateAudioObjectPath:id+"/audio.mp3",
});
describe("read-only two-real-identity RLS probe policy", () => {
  it("requires positive owner fixtures and denies all three cross-owner read surfaces", async () => {
    const receipt = await verifyTwoUserMusicReadIsolation(
      { jwt:"jwt-alice",client:fakeClient(aliceId),fixture:fixture(aliceId) },
      { jwt:"jwt-bob",client:fakeClient(bobId),fixture:fixture(bobId) },
    );
    expect(receipt.ownerRecordsReadable).toBe(true);
    expect(receipt.crossUserStorageDenied).toBe(true);
    expect(receipt.includesWriteAuthorizationProof).toBe(false);
    expect(receipt.livePlaybackCertified).toBe(false);
  });
  it("fails shut when one user can see a second user's catalog", async () => {
    await expect(verifyTwoUserMusicReadIsolation(
      { jwt:"jwt-alice",client:fakeClient(aliceId,true),fixture:fixture(aliceId) },
      { jwt:"jwt-bob",client:fakeClient(bobId),fixture:fixture(bobId) },
    )).rejects.toThrow("Cross-user track exposure");
  });
  it("rejects identity mismatches and reused credentials", async () => {
    await expect(verifyTwoUserMusicReadIsolation(
      { jwt:"same",client:fakeClient(aliceId),fixture:fixture(aliceId) },
      { jwt:"same",client:fakeClient(bobId),fixture:fixture(bobId) },
    )).rejects.toThrow();
    await expect(verifyTwoUserMusicReadIsolation(
      { jwt:"jwt-a",client:fakeClient(bobId),fixture:fixture(aliceId) },
      { jwt:"jwt-b",client:fakeClient(bobId),fixture:fixture(bobId) },
    )).rejects.toThrow("Independent identity verification failed");
  });
});
