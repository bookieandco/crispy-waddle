import { describe, expect, it, vi } from "vitest";
import { InMemoryMusicRepository } from "./repository.js";
import { SpotifyWebApiProvider } from "./spotify-provider.js";

describe("SpotifyWebApiProvider", () => {
  it("builds a stateful OAuth authorization URL", () => {
    const provider = new SpotifyWebApiProvider({ clientId: "client", redirectUri: "https://example.test/callback" }, { accessToken: "token" });
    const url = new URL(provider.authorizationUrl("state-123"));
    expect(url.searchParams.get("client_id")).toBe("client");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.test/callback");
  });

  it("imports Spotify track metadata into the user-scoped repository", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "track-1", name: "Example", duration_ms: 1234, explicit: false, track_number: 1, disc_number: 1,
      external_ids: { isrc: "US-AAA-00-00001" },
      artists: [{ id: "artist-1", name: "Artist" }],
      album: { id: "album-1", name: "Album", release_date: "2026-01-01", artists: [{ id: "artist-1", name: "Artist" }], images: [{ url: "https://img.test/a.jpg" }] },
    }))));
    const repository = new InMemoryMusicRepository();
    const provider = new SpotifyWebApiProvider({ clientId: "client", redirectUri: "https://example.test/callback" }, { accessToken: "token" }, repository);
    const track = await provider.importTrack("user-1", "track-1");
    expect(track.id).toBe("spotify:track:track-1");
    expect((await repository.listTracks("user-1"))).toHaveLength(1);
    expect((await repository.listSources("user-1"))[0].kind).toBe("spotify");
    expect(await repository.listTracks("user-2")).toHaveLength(0);
  });
});
