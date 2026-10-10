import { describe, expect, it } from "vitest";
import { InMemoryMusicRepository, admitPublisherMedia } from "@jhadina/music-core";
import { listCuratedRadioStations } from "./radio-directory";
const reviewed = {
  kind: "internet_radio" as const, publisherId: "publisher", itemId: "live",
  title: "Independent Live Station", creator: "Publisher Radio",
  streamUri: "https://radio.example.test/live.mp3", rightsEvidenceRef: "operator-rights:123",
  rightsReviewedBy: "operator", rightsReviewedAt: "2026-10-09T00:00:00Z",
};
describe("curated radio directory", () => {
  it("lists only publisher-reviewed, authorized stations in the selected user's catalog", async () => {
    const repo = new InMemoryMusicRepository();
    const admitted = await admitPublisherMedia(repo, "alice", reviewed);
    expect((await listCuratedRadioStations(repo, "alice"))[0].trackId).toBe(admitted.track.id);
    expect(await listCuratedRadioStations(repo, "bob")).toEqual([]);
    await repo.upsertSource({ ...admitted.source, authorized: false });
    expect(await listCuratedRadioStations(repo, "alice")).toEqual([]);
  });
});
