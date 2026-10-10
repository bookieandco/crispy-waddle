"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Album, Artist, ListeningEvent, Playlist, Track } from "@jhadina/music-core";
import { dispatchMusicPlayerCommand } from "@/lib/music/music-player-bus";

type Result = { track: Track; score: number; artistName?: string; albumName?: string };
type PlaybackRequest = { type: "play"; track: Track } | { type: "queue"; track: Track; mode: "next" | "last" };
type Library = { tracks: Track[]; artists: Artist[]; albums: Album[]; playlists: Playlist[]; recent: ListeningEvent[] };
type MusicReadiness = {
  status: "needs_configuration" | "environment_ready_for_playback_drill";
  missing: string[];
  authorizedSourceCount: number;
  livePlaybackCertified: false;
};
const emptyLibrary: Library = { tracks: [], artists: [], albums: [], playlists: [], recent: [] };

export default function MusicPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyPlaylistId, setSpotifyPlaylistId] = useState("");
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [spotifyNotice, setSpotifyNotice] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [musicReadiness, setMusicReadiness] = useState<MusicReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    try {
      const response = await fetch("/api/music/library", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to load your library" : "Library is temporarily unavailable");
      const result = await response.json() as { data?: Library };
      if (result.data) setLibrary(result.data);
      setLibraryError(null);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Unable to load library");
      setLibrary(emptyLibrary);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
    fetch("/api/music/youtube/status").then(r => r.json())
      .then(body => setYoutubeConnected(Boolean(body.connected)))
      .catch(() => setYoutubeConnected(false));
    fetch("/api/music/spotify/status", { cache: "no-store" }).then(r => r.json())
      .then(body => setSpotifyConnected(Boolean(body.connected)))
      .catch(() => setSpotifyConnected(false));
  }, [loadLibrary]);

  const artists = useMemo(() => new Map(library.artists.map(artist => [artist.id, artist.name])), [library.artists]);
  const albumNames = useMemo(() => new Map(library.albums.map(album => [album.id, album.title])), [library.albums]);
  const tracks = useMemo(() => new Map(library.tracks.map(track => [track.id, track])), [library.tracks]);
  const recentTracks = useMemo(() => {
    const seen = new Set<string>();
    return library.recent.flatMap(event => {
      const track = tracks.get(event.trackId);
      if (!track || seen.has(event.trackId)) return [];
      seen.add(event.trackId);
      return [track];
    });
  }, [library.recent, tracks]);
  const recommendations = useMemo(() => {
    // Explicitly a local heuristic, not an ML recommendation or consented permanent preference.
    const counts = new Map<string, number>();
    for (const event of library.recent.filter(e => e.completed)) {
      const song = tracks.get(event.trackId);
      for (const id of song?.artistIds ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...library.tracks].filter(t => !recentTracks.some(r => r.id === t.id))
      .sort((a,b) => b.artistIds.reduce((n,id) => n + (counts.get(id) ?? 0), 0)
        - a.artistIds.reduce((n,id) => n + (counts.get(id) ?? 0), 0))
      .slice(0,8);
  }, [library.tracks, library.recent, tracks, recentTracks]);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const body = await response.json() as { data?: { results?: Result[] }; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Search unavailable");
      setResults(body.data?.results ?? []);
      setPlaybackError(null);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : "Search unavailable");
      setResults([]);
    } finally { setLoading(false); }
  }

  function send(request: PlaybackRequest) {
    // Browser commands carry catalog identity, never signed playback URLs.
    // The persistent player independently fetches a fresh authorized ticket.
    setPlaybackError(null);
    dispatchMusicPlayerCommand(request);
  }

  async function importSpotifyPlaylist() {
    if (!spotifyConnected || !/^[A-Za-z0-9]{1,64}$/.test(spotifyPlaylistId) || spotifyBusy) return;
    setSpotifyBusy(true);
    setSpotifyNotice(null);
    try {
      const response = await fetch("/api/music/spotify/import", {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ playlistId: spotifyPlaylistId }),
      });
      const data = await response.json() as { data?: { count?: number }; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Spotify library import failed");
      setSpotifyNotice(`Imported ${data.data?.count ?? 0} catalog items — no playback rights granted`);
      await loadLibrary();
    } catch (error) {
      setSpotifyNotice(error instanceof Error ? error.message : "Spotify import unavailable");
    } finally { setSpotifyBusy(false); }
  }

  async function checkMusicReadiness() {
    setCheckingReadiness(true);
    setReadinessError(null);
    try {
      const response = await fetch("/api/music/readiness", { cache: "no-store" });
      const result = await response.json() as { data?: MusicReadiness; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Readiness check unavailable");
      setMusicReadiness(result.data);
    } catch(error) {
      setMusicReadiness(null);
      setReadinessError(error instanceof Error ? error.message : "Readiness check unavailable");
    } finally {
      setCheckingReadiness(false);
    }
  }

  async function savePlaylist() {
    if (!playlistName.trim() || !selectedTrackIds.length || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/music/playlists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playlistName.trim(), trackIds: selectedTrackIds }),
      });
      const result = await response.json() as { data?: Playlist; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Playlist could not be saved");
      setPlaylistName("");
      setSelectedTrackIds([]);
      setNotice("Playlist saved");
      await loadLibrary();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Playlist could not be saved");
    } finally { setSaving(false); }
  }

  function songRow(track: Track, key: string, artistName?: string) {
    const name = artistName ?? track.artistIds.map(id => artists.get(id) ?? id).join(" · ");
    return (
      <div key={key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3">
        <button onClick={() => void send({ type: "play", track })}
          className="min-w-0 flex-1 text-left" title="Play if an authorized source is available">
          <span className="block truncate text-sm font-medium">{track.title}</span>
          <span className="block truncate text-xs text-white/45">{name || "Unknown artist"}{track.albumId && albumNames.has(track.albumId) ? ` · ${albumNames.get(track.albumId)}` : ""}</span>
        </button>
        <button onClick={() => void send({ type: "queue", track, mode: "next" })}
          className="rounded-lg border border-white/15 px-2 py-2 text-xs text-white/70">Next</button>
        <label className="flex items-center gap-1 text-xs text-white/60">
          <input aria-label={`Select ${track.title} for playlist`} type="checkbox" checked={selectedTrackIds.includes(track.id)}
            onChange={event => setSelectedTrackIds(ids => event.target.checked ? [...new Set([...ids, track.id])] : ids.filter(id => id !== track.id))} />
          Save
        </label>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#07080b] pb-40 text-white">
      <div className="mx-auto max-w-7xl px-5 pt-7 md:px-10 md:pt-10">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-[11px] uppercase tracking-[.35em] text-white/35">Jhadina</p><h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">Music</h1></div>
          <div className="flex flex-wrap gap-3">
            <a href="/music/juggernaut" className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black">Music Juggernaut</a>
            <a href="/music/restoration" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70">Restoration Studio</a>
            <a href="/api/auth/youtube/start" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70">{youtubeConnected ? "YouTube connected" : "Connect YouTube"}</a>
            <a href="/api/auth/spotify/start" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70">{spotifyConnected ? "Reconnect Spotify" : "Connect Spotify"}</a>
          </div>
        </header>
        <section className="rounded-[2rem] border border-white/10 bg-white/[.045] p-7 md:p-12">
          <p className="text-sm text-white/40">Ask Jhadina</p><h2 className="mt-3 text-3xl font-medium md:text-5xl">Find the music you&apos;re feeling.</h2>
          <div className="mt-8 flex max-w-3xl gap-3">
            <input value={query} onChange={event => setQuery(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") void search(); }}
              placeholder="Song, artist, album..." aria-label="Search your music"
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none" />
            <button onClick={() => void search()} disabled={loading} className="rounded-2xl bg-white px-5 py-4 font-medium text-black disabled:opacity-50">{loading ? "…" : "Search"}</button>
          </div>
        </section>
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.025] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-medium">Streaming readiness</h2>
              <p className="text-xs text-white/45">Check your catalog, owned-audio storage and cross-device resume without exposing account secrets.</p></div>
            <button onClick={() => void checkMusicReadiness()} disabled={checkingReadiness}
              className="rounded-xl border border-white/20 px-3 py-2 text-xs disabled:opacity-50">
              {checkingReadiness ? "Checking…" : "Check readiness"}
            </button>
          </div>
          {readinessError && <p role="alert" className="mt-3 text-sm text-amber-300">{readinessError}</p>}
          {musicReadiness && <div role="status" className="mt-3 text-sm text-white/70">
            <p>{musicReadiness.status === "environment_ready_for_playback_drill"
              ? "Backend probes ready for a real playback drill."
              : "Setup still needed before a live playback drill."}</p>
            <p className="mt-1 text-xs text-white/45">{musicReadiness.authorizedSourceCount} authorized source(s). Live playback is not yet certified.</p>
            {musicReadiness.missing.length > 0 && <p className="mt-1 text-xs text-amber-200">Pending: {musicReadiness.missing.map(item => item.replaceAll("_", " ")).join(" · ")}</p>}
          </div>}
        </section>
        {playbackError && <p role="alert" className="mt-4 text-sm text-amber-300">{playbackError}</p>}
        {libraryError && <p role="status" className="mt-4 text-sm text-white/60">{libraryError}</p>}
        {results.length > 0 && <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">Search results</h2>
          <div className="grid gap-2">{results.map(result => songRow(result.track, `search:${result.track.id}`, result.artistName))}</div>
        </section>}
        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.025] p-5">
          <h2 className="text-xl font-semibold">Spotify library</h2>
          <p className="mt-1 text-sm text-white/40">Import authorized account playlist metadata. Spotify streaming, offline audio, and downloads are not included.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input aria-label="Spotify playlist ID" placeholder="Playlist ID (from Spotify link)"
              value={spotifyPlaylistId} onChange={event => setSpotifyPlaylistId(event.target.value.trim())}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
            <button onClick={() => void importSpotifyPlaylist()} disabled={!spotifyConnected || !spotifyPlaylistId || spotifyBusy}
              className="rounded-xl bg-white px-4 py-2 text-sm text-black disabled:opacity-30">
              {spotifyBusy ? "Importing…" : "Import metadata"}
            </button>
            {spotifyConnected && <button className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60"
              onClick={() => void fetch("/api/music/spotify/disconnect", { method:"POST" })
                .then(response => { if (response.ok) { setSpotifyConnected(false); setSpotifyNotice("Local Spotify connection cleared"); } })}>
              Disconnect
            </button>}
          </div>
          {spotifyNotice && <p role="status" className="mt-2 text-sm text-white/65">{spotifyNotice}</p>}
        </section>
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
            <h2 className="text-xl font-semibold">Internet Radio</h2>
            <p className="mb-4 text-sm text-white/40">Only publisher streams admitted with reviewed playback rights</p>
            <div className="space-y-2">
              {library.tracks.filter(track => track.id.startsWith("radio:")).map(track => songRow(track, `radio:${track.id}`))}
              {!library.tracks.some(track => track.id.startsWith("radio:")) && <p className="text-sm text-white/40">No verified radio stations connected yet.</p>}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
            <h2 className="text-xl font-semibold">Podcasts</h2>
            <p className="mb-4 text-sm text-white/40">Publisher-hosted episodes with authorized playback, no implicit downloads</p>
            <div className="space-y-2">
              {library.tracks.filter(track => track.id.startsWith("podcast:")).map(track => songRow(track, `podcast:${track.id}`))}
              {!library.tracks.some(track => track.id.startsWith("podcast:")) && <p className="text-sm text-white/40">No publisher-approved podcast episodes connected yet.</p>}
            </div>
          </div>
        </section>
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
            <h2 className="text-xl font-semibold">Your Library</h2>
            <p className="mb-4 text-sm text-white/40">{library.tracks.length} tracks · {library.albums.length} albums · {library.playlists.length} playlists</p>
            <div className="max-h-80 space-y-2 overflow-auto">
              {library.tracks.slice(0,50).map(track => songRow(track, `lib:${track.id}`))}
              {!library.tracks.length && <p className="text-sm text-white/40">No imported music yet. Your authorized catalog will appear here.</p>}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
            <h2 className="text-xl font-semibold">Recently Played</h2>
            <p className="mb-4 text-sm text-white/40">Based on this account&apos;s listening sessions</p>
            <div className="max-h-80 space-y-2 overflow-auto">{recentTracks.slice(0,12).map(track => songRow(track, `recent:${track.id}`))}
              {!recentTracks.length && <p className="text-sm text-white/40">No recorded listening history yet.</p>}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
            <h2 className="text-xl font-semibold">For You</h2>
            <p className="mb-4 text-sm text-white/40">Early suggestions using recently completed listening sessions, not AI personalization yet</p>
            <div className="max-h-80 space-y-2 overflow-auto">{recommendations.map(track => songRow(track, `for-you:${track.id}`))}
              {!recommendations.length && <p className="text-sm text-white/40">Add music and listen to build recommendations.</p>}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
            <h2 className="text-xl font-semibold">Playlists</h2>
            <p className="mb-3 text-sm text-white/40">Select songs from the library or results above, then save a playlist.</p>
            <div className="flex gap-2">
              <input value={playlistName} onChange={event => setPlaylistName(event.target.value)}
                aria-label="Playlist name" placeholder="New playlist name"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
              <button disabled={saving || !playlistName.trim() || !selectedTrackIds.length}
                onClick={() => void savePlaylist()} className="rounded-xl bg-white px-4 py-2 text-sm text-black disabled:opacity-40">Save ({selectedTrackIds.length})</button>
            </div>
            {notice && <p role="status" className="mt-2 text-xs text-white/65">{notice}</p>}
            <div className="mt-4 max-h-64 space-y-2 overflow-auto">
              {library.playlists.map(playlist => <div key={playlist.id} className="rounded-xl border border-white/10 p-3">
                <strong className="text-sm">{playlist.name}</strong><p className="text-xs text-white/45">{playlist.trackIds.length} tracks</p>
                <button className="mt-2 text-xs text-white/70 underline"
                  onClick={() => { setSelectedTrackIds(playlist.trackIds); setPlaylistName(playlist.name + " (copy)"); }}>Copy as new playlist</button>
              </div>)}
              {!library.playlists.length && <p className="text-sm text-white/40">No saved playlists yet.</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
