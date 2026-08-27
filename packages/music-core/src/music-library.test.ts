import { describe, expect, it } from "vitest";
import { createMusicLibraryState, markDownloaded, recordPlayed, toggleFavorite, upsertTracks } from "./music-library.js";
import type { Track } from "./types.js";

const track: Track = { id: "track-1", title: "Test Song", artistIds: ["artist-1"] };


describe("music library", () => {
  it("upserts tracks without duplicates", () => {
    const state = upsertTracks(createMusicLibraryState(), [track, track]);
    expect(state.tracks).toHaveLength(1);
  });

  it("toggles favorites", () => {
    const initial = createMusicLibraryState();
    const favorited = toggleFavorite(initial, track.id);
    expect(favorited.favoriteTrackIds).toEqual([track.id]);
    expect(toggleFavorite(favorited, track.id).favoriteTrackIds).toEqual([]);
  });

  it("keeps recently played ordered and unique", () => {
    let state = recordPlayed(createMusicLibraryState(), "a");
    state = recordPlayed(state, "b");
    state = recordPlayed(state, "a");
    expect(state.recentlyPlayedTrackIds).toEqual(["a", "b"]);
  });

  it("marks a track downloaded once", () => {
    let state = markDownloaded(createMusicLibraryState(), track.id);
    state = markDownloaded(state, track.id);
    expect(state.downloadedTrackIds).toEqual([track.id]);
  });
});
