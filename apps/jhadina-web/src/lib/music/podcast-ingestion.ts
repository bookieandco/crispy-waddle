import { createHash } from "node:crypto";
import type { MusicRepository } from "@jhadina/music-core";
import { admitPublisherMedia } from "@jhadina/music-core";

/** Curator-supplied XML only. Never fetch an arbitrary URL from an anonymous request. */
export interface ReviewedPodcastFeed {
  publisherId: string;
  creator: string;
  sourceUrl: string;
  rightsEvidenceRef: string;
  rightsReviewedBy: string;
  rightsReviewedAt: string;
}
export interface PodcastEpisode {
  itemId: string;
  title: string;
  creator: string;
  streamUri: string;
  durationMs?: number;
}
const MAX_XML = 1024 * 1024;
const MAX_EPISODES = 120;
const decode = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (s, code: string) => {
    const known: Record<string,string> = {amp:"&",lt:"<",gt:">",quot:'"',apos:"'"};
    if (known[code.toLowerCase()]) return known[code.toLowerCase()];
    if (!code.startsWith("#")) return s;
    const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
      ? String.fromCodePoint(value) : "";
  }).trim();

const tag = (xml: string, name: string): string | undefined => {
  const pattern = new RegExp(`<(?:[A-Za-z0-9_-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${name}>`, "i");
  const match = xml.match(pattern);
  return match ? decode(match[1].replace(/<[^>]+>/g, "")) : undefined;
};
const attr = (fragment: string, name: string) => {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const match = fragment.match(pattern);
  return match ? decode(match[1] ?? match[2] ?? "") : undefined;
};
const episodeId = (identity: string) => createHash("sha256").update(identity).digest("hex").slice(0, 40);

export function parseReviewedPodcastFeed(xml: string, feed: ReviewedPodcastFeed): PodcastEpisode[] {
  if (!feed.publisherId || !/^[A-Za-z0-9_-]{1,80}$/.test(feed.publisherId)
    || !feed.creator?.trim() || !feed.sourceUrl.startsWith("https://")
    || !feed.rightsEvidenceRef || !feed.rightsReviewedBy || !Number.isFinite(Date.parse(feed.rightsReviewedAt))) {
    throw new Error("Reviewed publisher feed manifest is incomplete");
  }
  if (typeof xml !== "string" || xml.length > MAX_XML || !/\<(rss|feed)\b/i.test(xml)
    || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Invalid or unsafe publisher feed XML");
  const entries = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  if (!entries.length || entries.length > MAX_EPISODES) throw new Error("Feed must contain 1–120 episodes");
  const result: PodcastEpisode[] = [];
  const seen = new Set<string>();
  for (const [, , body] of entries) {
    const title = tag(body, "title");
    const guid = tag(body, "guid") ?? tag(body, "id");
    const candidate = /<enclosure\b([^>]*?)\/?\s*>/i.exec(body)?.[1];
    const atomLinks = [...body.matchAll(/<link\b([^>]*?)\/?\s*>/gi)].map(m => m[1]);
    const atom = atomLinks.find(fragment => attr(fragment, "rel") === "enclosure");
    const url = candidate ? attr(candidate, "url") : atom ? attr(atom, "href") : undefined;
    const type = candidate ? attr(candidate, "type") : atom ? attr(atom, "type") : undefined;
    if (!title || title.length > 250 || !url || (type && !/^audio\//i.test(type))) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) continue;
    } catch { continue; }
    const id = episodeId(feed.publisherId + ":" + (guid || url));
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ itemId: id, title, creator: tag(body, "author") ?? feed.creator, streamUri: url });
  }
  if (!result.length) throw new Error("No valid HTTPS audio enclosures found");
  return result;
}

/** Operator-only ingest. Rights were reviewed separately; reading feed metadata does not confer rights. */
export async function ingestReviewedPodcastXml(
  repository: MusicRepository, userId: string, feed: ReviewedPodcastFeed, xml: string,
) {
  const episodes = parseReviewedPodcastFeed(xml, feed);
  for (const episode of episodes) {
    await admitPublisherMedia(repository, userId, {
      kind: "podcast_episode", publisherId: feed.publisherId,
      itemId: episode.itemId, title: episode.title, creator: episode.creator,
      streamUri: episode.streamUri, rightsEvidenceRef: feed.rightsEvidenceRef,
      rightsReviewedBy: feed.rightsReviewedBy, rightsReviewedAt: feed.rightsReviewedAt,
    });
  }
  return { publisherId: feed.publisherId, imported: episodes.length };
}
