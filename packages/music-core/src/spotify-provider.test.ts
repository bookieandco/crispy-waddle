import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryMusicRepository } from "./repository.js";
import { SpotifyWebApiProvider } from "./spotify-provider.js";

const song = (id: string) => ({
  id, type: "track", name: `Track ${id}`, duration_ms: 186000, explicit: false,
  track_number: 1, disc_number: 1, artists: [{ id: "artist1", name: "Artist" }],
  album: { id: "album1", name: "Album", artists: [{ id: "artist1", name: "Artist" }] },
});
afterEach(() => vi.unstubAllGlobals());

describe("Spotify 2026 catalog import", () => {
  it("imports paginated playlist items with no playback entitlement", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      if (url.endsWith("/playlists/123")) return {
        ok: true, json: async () => ({
          id: "123", name: "Playlist", items: {
            items: [{ item: song("one") }],
            next: "https://api.spotify.com/v1/playlists/123/items?offset=1&limit=50",
          },
        }),
      };
      if (url.includes("offset=1")) return {
        ok: true, json: async () => ({ items: [{ item: song("two") }], next: null }),
      };
      return { ok: false, status: 404 };
    }));
    const repository = new InMemoryMusicRepository();
    const provider = new SpotifyWebApiProvider({ clientId: "test", redirectUri: "https://app.example/callback" }, { accessToken: "stub" }, repository);
    const playlist = await provider.importPlaylist("alice", "123");
    expect(playlist.trackIds).toEqual(["spotify:track:one", "spotify:track:two"]);
    expect((await repository.listTracks("alice"))).toHaveLength(2);
    expect((await repository.listTracks("bob"))).toHaveLength(0);
    expect((await repository.listSources("alice"))[0].authorized).toBe(false);
    expect(urls).toHaveLength(2);
    expect((await repository.listPlaylists("bob"))).toHaveLength(0);
  });
  it("rejects external playlist pagination URLs before any song import", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({
        id: "123", name: "Playlist", items: {
          items: [{ item: song("one") }],
          next: "https://evil.example/collect?token=unsafe",
        },
      }),
    })));
    const repository = new InMemoryMusicRepository();
    const provider = new SpotifyWebApiProvider({ clientId: "test", redirectUri: "https://app.example/callback" }, { accessToken: "stub" }, repository);
    await expect(provider.importPlaylist("alice", "123")).rejects.toThrow("pagination URL");
    expect(await repository.listTracks("alice")).toEqual([]);
  });
  it("does not treat inaccessible non-owned playlists as an empty imported list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: "123", name: "Other person's playlist" }) })));
    const repository = new InMemoryMusicRepository();
    const provider = new SpotifyWebApiProvider({ clientId: "test", redirectUri: "https://app.example/callback" }, { accessToken: "stub" }, repository);
    await expect(provider.importPlaylist("alice", "123")).rejects.toThrow("unavailable");
    expect(await repository.listPlaylists("alice")).toEqual([]);
  });
});
