import type { Track } from "@jhadina/music-core";
import type { FeedItem } from "./core";

export function tracksToFeedItems(tracks: Track[]): FeedItem[] {
  return tracks.map((track) => ({
    id: `music-${track.id}`,
    kind: "media",
    label: "Music",
    title: track.title,
    body: "A track from your connected music library.",
    status: track.explicit ? "explicit" : undefined,
    href: "/music",
    relevance: track.explicit ? 1 : 3,
  }));
}
