import { describe, expect, it } from "vitest";
import { InMemoryMusicRepository } from "@jhadina/music-core";
import { ingestReviewedPodcastXml, parseReviewedPodcastFeed } from "./podcast-ingestion";

const reviewed = {
  publisherId: "approved", creator: "Publisher",
  sourceUrl: "https://publisher.example.test/rss",
  rightsEvidenceRef: "reviewed-contract:123", rightsReviewedBy: "operator",
  rightsReviewedAt: "2026-10-09T00:00:00Z",
};
const xml = `<?xml version="1.0"?><rss><channel>
<item><title>Episode &amp; Dreams</title><guid>episode-1</guid><enclosure url="https://cdn.publisher.test/e1.mp3" type="audio/mpeg"/></item>
<item><title>Episode 2</title><guid>episode-2</guid><enclosure url="http://127.0.0.1/a.mp3" type="audio/mpeg"/></item>
</channel></rss>`;

describe("reviewed podcast ingestion", () => {
  it("parses a bounded RSS subset and admits only owner-scoped authorized metadata", async () => {
    const episodes = parseReviewedPodcastFeed(xml, reviewed);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].title).toBe("Episode & Dreams");
    const repo = new InMemoryMusicRepository();
    const result = await ingestReviewedPodcastXml(repo, "alice", reviewed, xml);
    expect(result.imported).toBe(1);
    expect((await repo.listTracks("alice"))[0].id).toMatch(/^podcast:approved:/);
    expect(await repo.listTracks("bob")).toHaveLength(0);
  });
  it("parses Atom audio enclosure feeds without automatic network fetching", () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Song Talk</title><id>tag:publisher,2026:1</id><link rel="enclosure" href="https://publisher.example.test/ep.ogg" type="audio/ogg"/></entry></feed>`;
    expect(parseReviewedPodcastFeed(atom, reviewed)[0].streamUri).toBe("https://publisher.example.test/ep.ogg");
  });
  it("blocks entity declarations and excessive feeds", () => {
    expect(() => parseReviewedPodcastFeed("<!DOCTYPE rss [<!ENTITY x SYSTEM 'file:///etc/passwd'>]>" + xml, reviewed)).toThrow();
    expect(() => parseReviewedPodcastFeed("x".repeat(1024*1024+1), reviewed)).toThrow();
    expect(() => parseReviewedPodcastFeed(xml, {...reviewed, rightsEvidenceRef:""})).toThrow();
  });
});
