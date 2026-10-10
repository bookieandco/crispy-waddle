import { describe, expect, it } from "vitest";
import { searchTracks } from "./search.js";
import type { Track } from "./types.js";

const songs: Track[] = [
  { id: "one", title: "Midnight", artistIds: ["artist1"], albumId: "album1" },
  { id: "two", title: "Daylight", artistIds: ["artist2"], albumId: "album2" },
];
describe("Artist and album search", () => {
  const context = {
    artists: [{ id: "artist1", name: "Atwood Bookie" }, { id: "artist2", name: "Other Singer" }],
    albums: [{ id: "album1", title: "Rare Sessions", artistIds: ["artist1"] }, { id: "album2", title: "New Days", artistIds: ["artist2"] }],
  };
  it("matches artist names and albums without leaking unrelated tracks", () => {
    expect(searchTracks(songs, "Atwood", context).map(result => result.track.id)).toEqual(["one"]);
    expect(searchTracks(songs, "Rare Sessions", context)[0]).toMatchObject({ track: { id: "one" }, albumName: "Rare Sessions", artistName: "Atwood Bookie" });
    expect(searchTracks(songs, "Unknown", context)).toEqual([]);
  });
  it("preserves title-only search compatibility", () => {
    expect(searchTracks(songs, "Daylight")[0].track.id).toBe("two");
  });
});
