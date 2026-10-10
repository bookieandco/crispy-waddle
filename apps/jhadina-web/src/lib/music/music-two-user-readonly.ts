import type { SupabaseClient } from "@supabase/supabase-js";

export interface MusicTenantFixture {
  userId: string;
  trackId: string;
  checkpointTrackId: string;
  privateAudioObjectPath: string;
}
export interface MusicTwoUserIsolationReceipt {
  schema: "jhadina.music.rls-readonly-proof.v1";
  usersIndependentlyVerified: true;
  twoDistinctUsers: true;
  ownerRecordsReadable: true;
  crossUserCatalogDenied: true;
  crossUserCheckpointDenied: true;
  crossUserStorageDenied: true;
  includesWriteAuthorizationProof: false;
  livePlaybackCertified: false;
}

const HEX_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type User = { client: SupabaseClient; jwt: string; fixture: MusicTenantFixture };

/** ONLY READS existing records. Never seeds, deletes, uploads or mutates. */
export async function verifyTwoUserMusicReadIsolation(
  alice: User, bob: User,
): Promise<MusicTwoUserIsolationReceipt> {
  if (!alice.jwt || !bob.jwt || alice.jwt === bob.jwt) throw new Error("Two distinct authentication grants required");
  const actors = [alice, bob];
  for (const actor of actors) {
    const f = actor.fixture;
    if (!HEX_UUID.test(f.userId)
      || !f.trackId || f.trackId.length > 256
      || !f.checkpointTrackId || f.checkpointTrackId.length > 256
      || !f.privateAudioObjectPath.startsWith(`${f.userId}/`)
      || !/^[a-zA-Z0-9_.-]+$/.test(f.privateAudioObjectPath.slice(f.userId.length + 1))) {
      throw new Error("A known owned catalog/checkpoint/storage fixture is required");
    }
    // Supabase verifies the JWT signature and the actual account identity.
    const { data, error } = await actor.client.auth.getUser(actor.jwt);
    if (error || data.user?.id !== f.userId) throw new Error("Independent identity verification failed");
  }
  if (alice.fixture.userId === bob.fixture.userId) throw new Error("Distinct user identities required");
  const listTrack = async (actor: User, fixture: MusicTenantFixture) => {
    const { data, error } = await actor.client.from("music_tracks").select("id")
      .eq("user_id", fixture.userId).eq("id", fixture.trackId).limit(1);
    if (error) throw new Error("Catalog test unavailable");
    return (data ?? []).some(record => record.id === fixture.trackId);
  };
  const listCheckpoint = async (actor: User, fixture: MusicTenantFixture) => {
    const { data, error } = await actor.client.from("music_playback_checkpoints").select("track_id")
      .eq("user_id", fixture.userId).eq("track_id", fixture.checkpointTrackId).limit(1);
    if (error) throw new Error("Checkpoint test unavailable");
    return (data ?? []).some(record => record.track_id === fixture.checkpointTrackId);
  };
  const listStorage = async (actor: User, fixture: MusicTenantFixture) => {
    const [folder, basename] = fixture.privateAudioObjectPath.split("/");
    const { data, error } = await actor.client.storage.from("music-owned")
      .list(folder, { search: basename, limit: 10 });
    if (error) throw new Error("Private owned-audio test unavailable");
    return (data ?? []).some(record => record.name === basename);
  };
  for (const actor of actors) {
    if (!await listTrack(actor, actor.fixture)
      || !await listCheckpoint(actor, actor.fixture)
      || !await listStorage(actor, actor.fixture)) {
      throw new Error("Missing known-positive owner test fixture: cannot certify isolation");
    }
  }
  for (const actor of actors) {
    const other = actor === alice ? bob : alice;
    if (await listTrack(actor, other.fixture)) throw new Error("Cross-user track exposure");
    if (await listCheckpoint(actor, other.fixture)) throw new Error("Cross-user checkpoint exposure");
    if (await listStorage(actor, other.fixture)) throw new Error("Cross-user private-object exposure");
  }
  return {
    schema: "jhadina.music.rls-readonly-proof.v1",
    usersIndependentlyVerified: true,
    twoDistinctUsers: true,
    ownerRecordsReadable: true,
    crossUserCatalogDenied: true,
    crossUserCheckpointDenied: true,
    crossUserStorageDenied: true,
    includesWriteAuthorizationProof: false,
    livePlaybackCertified: false,
  };
}
