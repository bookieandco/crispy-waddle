"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Album, Artist, ListeningEvent, Playlist, Track } from "@jhadina/music-core";
import { dispatchMusicPlayerCommand } from "@/lib/music/music-player-bus";

type Result = { track: Track; score: number; artistName?: string; albumName?: string };
type Library = { tracks: Track[]; artists: Artist[]; albums: Album[]; playlists: Playlist[]; recent: ListeningEvent[] };
type PlaybackRequest = { type: "play"; track: Track } | { type: "queue"; track: Track; mode: "next" | "last" };
const EMPTY: Library = { tracks: [], artists: [], albums: [], playlists: [], recent: [] };

export default function MusicPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [library, setLibrary] = useState<Library>(EMPTY);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [youtubeConnected, setYoutubeConnected] = useState(false);

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const response = await fetch("/api/music/library", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to load your music." : "Library currently unavailable.");
      const body = await response.json() as { data?: Library };
      if (!body.data || !Array.isArray(body.data.tracks)) throw new Error("Invalid music library response.");
      setLibrary(body.data);
      setLibraryError(null);
    } catch (error) {
      setLibrary(EMPTY);
      setLibraryError(error instanceof Error ? error.message : "Library currently unavailable.");
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLibrary();
    void fetch("/api/music/youtube/status", { cache: "no-store" })
      .then(r => r.json()).then(body => setYoutubeConnected(Boolean(body.connected)))
      .catch(() => setYoutubeConnected(false));
  }, [refreshLibrary]);

  const artists = useMemo(() => new Map(library.artists.map(a => [a.id, a.name])), [library.artists]);
  const albums = useMemo(() => new Map(library.albums.map(a => [a.id, a.title])), [library.albums]);
  const trackIndex = useMemo(() => new Map(library.tracks.map(t => [t.id, t])), [library.tracks]);
  const displayArtist = (track: Track) => track.artistIds.map(id => artists.get(id) ?? id).join(" · ") || "Unknown artist";
  const recentTracks = useMemo(() => {
    const ids = new Set<string>();
    return library.recent.flatMap(event => {
      if (ids.has(event.trackId)) return [];
      const track = trackIndex.get(event.trackId);
      if (!track) return [];
      ids.add(event.trackId);
      return [track];
    });
  }, [library.recent, trackIndex]);
  const suggestions = useMemo(() => {
    const favorites = new Map<string, number>();
    for (const event of library.recent) {
      if (!event.completed) continue;
      for (const id of trackIndex.get(event.trackId)?.artistIds ?? []) favorites.set(id, (favorites.get(id) ?? 0) + 1);
    }
    if (favorites.size === 0) return [];
    const heard = new Set(recentTracks.map(t => t.id));
    return library.tracks.filter(t => !heard.has(t.id) && t.artistIds.some(id => favorites.has(id)))
      .sort((a, b) => b.artistIds.reduce((sum, id) => sum + (favorites.get(id) ?? 0), 0)
        - a.artistIds.reduce((sum, id) => sum + (favorites.get(id) ?? 0), 0)).slice(0, 6);
  }, [library.recent, library.tracks, trackIndex, recentTracks]);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setSearchError(null);
    try {
      const response = await fetch("/api/music/search?q=" + encodeURIComponent(query.trim()), { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to search music." : "Search temporarily unavailable.");
      const body = await response.json() as { data?: { results?: Result[] } };
      setResults(body.data?.results ?? []);
    } catch (error) {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : "Search temporarily unavailable.");
    } finally { setLoading(false); }
  }

  async function send(request: PlaybackRequest) {
    setPlaybackError(null);
    try {
      // A search result is catalog metadata, not permission to play audio.
      const response = await fetch("/api/music/playback?trackId=" + encodeURIComponent(request.track.id), { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404
        ? "No authorized audio source is available for this track."
        : "Playback authorization is temporarily unavailable.");
      const body = await response.json() as { data?: { trackId?: string } };
      if (body.data?.trackId !== request.track.id) throw new Error("Playback authorization did not match this track.");
      // Do not put ephemeral playback URLs in browser events or localStorage.
      dispatchMusicPlayerCommand(request);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : "Playback is unavailable.");
    }
  }

  function songRow(track: Track, key: string, subtitle?: string) {
    return <article key={key} className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3 sm:flex-nowrap">
      <button type="button" onClick={() => void send({ type: "play", track })}
        aria-label={"Play " + track.title}
        className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">♪</span>
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{track.title}</strong>
          <span className="block truncate text-xs text-white/45">{subtitle ?? displayArtist(track)}{track.albumId && albums.has(track.albumId) ? " · " + albums.get(track.albumId) : ""}</span>
        </span><span aria-hidden="true" className="text-white/60">▶</span>
      </button>
      <button type="button" onClick={() => void send({ type: "queue", track, mode: "next" })}
        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65">Next</button>
      <button type="button" onClick={() => void send({ type: "queue", track, mode: "last" })}
        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65">+ Queue</button>
    </article>;
  }

  return <main className="min-h-screen bg-[#07080b] text-white">
    <div className="mx-auto max-w-7xl px-4 pb-44 pt-7 sm:px-6 md:px-10 md:pt-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[11px] uppercase tracking-[.35em] text-white/35">Jhadina</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">Music</h1></div>
        <nav className="flex flex-wrap gap-2" aria-label="Music destinations">
          <a href="/music/juggernaut" className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black">Music Juggernaut</a>
          <a href="/music/restoration" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70">Restoration Studio</a>
          <a href="/api/auth/youtube/start" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70">{youtubeConnected ? "YouTube connected" : "Connect YouTube"}</a>
        </nav>
      </header>
      <section className="rounded-[2rem] border border-white/10 bg-white/[.045] p-5 sm:p-8 md:p-12">
        <p className="text-sm text-white/40">Ask Jhadina</p>
        <h2 className="mt-3 text-3xl font-medium leading-tight md:text-5xl">Find the music you&apos;re feeling.</h2>
        <div className="mt-7 flex max-w-3xl flex-wrap gap-3 sm:flex-nowrap">
          <input aria-label="Search music catalog" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void search(); }}
            placeholder="Song, artist, album..." className="min-w-0 flex-[1_1_220px] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none placeholder:text-white/25" />
          <button type="button" onClick={() => void search()} disabled={loading || !query.trim()}
            className="rounded-2xl bg-white px-5 py-3 font-medium text-black disabled:opacity-40">{loading ? "Searching…" : "Search"}</button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => window.dispatchEvent(new Event("jhadina:open-local-music"))}
            className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-black">Open Local Music · Play Your Files</button>
          <p className="max-w-md text-xs leading-5 text-white/55">Works independently of the cloud music database. Pick MP3/M4A files from iPhone Files; they stay on this device.</p>
        </div>
        <p className="mt-3 text-xs text-white/35">Catalog discoveries do not automatically grant streaming rights.</p>
      </section>
      {searchError && <p role="alert" className="mt-4 text-sm text-amber-300">{searchError}</p>}
      {playbackError && <p role="alert" className="mt-4 text-sm text-amber-300">{playbackError}</p>}
      {results.length > 0 && <section className="mt-9 space-y-2" aria-label="Search results">
        <h2 className="mb-3 text-xl font-semibold">Search results</h2>
        {results.map(result => songRow(result.track, "result:" + result.track.id, result.artistName))}
      </section>}
      <section className="mt-10" aria-label="Your music library">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-2xl font-semibold">Your Library</h2>
            <p className="mt-1 text-sm text-white/45">Your private catalog, not a claim that every track is playable.</p></div>
          <button type="button" onClick={() => void refreshLibrary()} disabled={libraryLoading}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 disabled:opacity-40">Refresh library</button>
        </div>
        {libraryLoading && <p role="status" className="text-sm text-white/50">Loading library…</p>}
        {libraryError && <p role="alert" className="text-sm text-amber-300">{libraryError}</p>}
        {!libraryLoading && !libraryError && <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="mb-3 text-base font-medium">Tracks ({library.tracks.length})</h3>
            {library.tracks.slice(0, 30).map(track => songRow(track, "library:" + track.id))}
            {!library.tracks.length && <p className="rounded-xl border border-white/10 p-4 text-sm text-white/45">No imported tracks yet. Use an authorized catalog import to build your library.</p>}
            {library.tracks.length > 30 && <p className="text-xs text-white/45">Showing 30 tracks. Search to find the rest.</p>}
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 p-5">
              <h3 className="text-base font-medium">Playlists ({library.playlists.length})</h3>
              {library.playlists.map(p => <p key={p.id} className="mt-3 text-sm text-white/70">{p.name} <span className="text-white/35">· {p.trackIds.length} tracks</span></p>)}
              {!library.playlists.length && <p className="mt-3 text-sm text-white/45">No saved playlists yet.</p>}
            </div>
            <div className="rounded-2xl border border-white/10 p-5">
              <h3 className="text-base font-medium">Recently Played</h3>
              <div className="mt-3 space-y-2">{recentTracks.slice(0, 6).map(track => songRow(track, "recent:" + track.id))}</div>
              {!recentTracks.length && <p className="mt-3 text-sm text-white/45">No completed local listening sessions recorded yet.</p>}
            </div>
            <div className="rounded-2xl border border-white/10 p-5">
              <h3 className="text-base font-medium">For You</h3>
              <p className="mt-1 text-xs text-white/40">A simple same-artist suggestion from completed sessions, not a trained recommendation model.</p>
              <div className="mt-3 space-y-2">{suggestions.map(track => songRow(track, "suggested:" + track.id))}</div>
              {!suggestions.length && <p className="mt-3 text-sm text-white/45">Listen to owned or otherwise authorized audio to build suggestions.</p>}
            </div>
          </div>
        </div>}
      </section>
    </div>
  </main>;
}
