import { describe, expect, it } from "vitest";
import { InMemoryMusicRepository } from "./repository.js";
import { admitPublisherMedia } from "./publisher-media.js";
import { validatePlaybackAsset } from "./playback-ticket.js";
const station = {
  kind: "internet_radio" as const,
  publisherId: "station", itemId: "live", title: "Live independent radio", creator: "Station",
  streamUri: "https://radio.example.test/live.mp3",
  rightsEvidenceRef: "operator-reviewed:station-2026-10", rightsReviewedBy: "publisher-compliance",
  rightsReviewedAt: "2026-10-09T00:00:00Z",
};
describe("Publisher radio and podcast admission", () => {
  it("admits an explicitly reviewed publisher stream to the owner library only", async () => {
    const db = new InMemoryMusicRepository();
    const { track, source } = await admitPublisherMedia(db, "alice", station);
    expect(track.id).toBe("radio:station:live");
    expect(source.metadata.mediaKind).toBe("internet_radio");
    expect(await db.listTracks("bob")).toEqual([]);
    const ticket = validatePlaybackAsset("alice", track.id, await db.listSources("alice"), (await db.listAssets("alice", track.id))[0]);
    expect(ticket?.sourceUri).toBe(station.streamUri);
    expect(validatePlaybackAsset("bob", track.id, await db.listSources("bob"), (await db.listAssets("alice", track.id))[0])).toBeNull();
  });
  it("rejects unreviewed rights, private endpoints and expired streaming links", async () => {
    const db = new InMemoryMusicRepository();
    await expect(admitPublisherMedia(db, "alice", { ...station, rightsEvidenceRef: "" })).rejects.toThrow();
    await expect(admitPublisherMedia(db, "alice", { ...station, streamUri: "http://127.0.0.1/live" })).rejects.toThrow();
    await expect(admitPublisherMedia(db, "alice", { ...station, streamUri: "https://radio.example.test/live?token=abc" })).rejects.toThrow();
    expect(await db.listTracks("alice")).toEqual([]);
  });
  it("supports publisher-hosted podcast episodes without licensing downloads", async () => {
    const db = new InMemoryMusicRepository();
    const { track } = await admitPublisherMedia(db, "alice", { ...station, kind: "podcast_episode", itemId: "ep1", durationMs: 1800000 });
    expect(track.id).toBe("podcast:station:ep1");
    expect(track.durationMs).toBe(1800000);
    expect((await db.listAssets("alice", track.id))[0].provenance?.offline).toBeUndefined();
  });
});
