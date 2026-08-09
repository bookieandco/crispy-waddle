"use client";

import { useMemo, useState } from "react";

type Track = { id: string; title: string; artist: string; album?: string; artworkUrl?: string; sourceUrl?: string; playable?: boolean; rightsStatus?: "owned" | "licensed" | "authorized_stream" | "unknown" };
type Playback = { status: "idle" | "playing" | "paused"; track?: Track };
type Mode = "search" | "discovery" | "favorites" | "playlists";
type Playlist = { id: string; name: string; trackIds: string[]; offline: boolean };

const FAVORITES_KEY = "jhadina.music.favorites";
const PLAYLISTS_KEY = "jhadina.music.playlists";

function load<T>(key: string, fallback: T): T { if (typeof window === "undefined") return fallback; try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }

export function JhadinaMusicCommand({ search, command }: { search: (query: string) => Promise<Track[]>; command: (action: "play" | "pause" | "resume" | "next" | "previous") => Promise<Playback> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [playback, setPlayback] = useState<Playback>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("search");
  const [favorites, setFavorites] = useState<string[]>(() => load(FAVORITES_KEY, []));
  const [playlists, setPlaylists] = useState<Playlist[]>(() => load(PLAYLISTS_KEY, []));
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function persistFavorites(next: string[]) { setFavorites(next); localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); }
  function persistPlaylists(next: Playlist[]) { setPlaylists(next); localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(next)); }
  function toggleFavorite(track: Track) { persistFavorites(favorites.includes(track.id) ? favorites.filter(id => id !== track.id) : [...favorites, track.id]); }
  function createPlaylist() { const name = window.prompt("Playlist name"); if (!name?.trim()) return; const next = [...playlists, { id: crypto.randomUUID(), name: name.trim(), trackIds: [], offline: false }]; persistPlaylists(next); setMode("playlists"); }
  function addToPlaylist(track: Track, playlistId: string) { persistPlaylists(playlists.map(p => p.id === playlistId && !p.trackIds.includes(track.id) ? { ...p, trackIds: [...p.trackIds, track.id] } : p)); setMessage(`Added “${track.title}” to playlist.`); }
  function toggleOffline(playlist: Playlist) { persistPlaylists(playlists.map(p => p.id === playlist.id ? { ...p, offline: !p.offline } : p)); setMessage(playlist.offline ? "Offline mode disabled." : "Offline playlist enabled for owned/licensed tracks."); }

  async function runSearch(nextQuery = query) { if (!nextQuery.trim()) return; setBusy(true); try { setResults(await search(nextQuery.trim())); } finally { setBusy(false); } }
  async function run(action: "play" | "pause" | "resume" | "next" | "previous") { setBusy(true); try { setPlayback(await command(action)); } finally { setBusy(false); } }
  async function playTrack(track: Track) { setBusy(true); try { setPlayback(await command("play")); } finally { setBusy(false); } }
  function enterDiscovery(seed?: string) { setMode("discovery"); const next = seed?.trim() || query.trim() || "Lil Wayne mixtapes deep cuts southern rap"; setQuery(next); void runSearch(next); }

  const visibleResults = useMemo(() => mode === "favorites" ? results.filter(t => favorites.includes(t.id)) : results, [mode, results, favorites]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.045] p-5 text-white shadow-2xl shadow-black/20 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.35em] text-white/30">Jhadina MusicOS</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{mode === "discovery" ? "Discovery Mode" : mode === "favorites" ? "Favorites" : mode === "playlists" ? "Playlists" : "What are we playing?"}</h2><p className="mt-1 text-sm text-white/35">Your library, favorites, playlists, and discovery in one place.</p></div><div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">{playback.status}</div></div>

      <div className="mt-6 flex flex-wrap gap-2">
        {([['search','Search'],['discovery','Discovery'],['favorites','Favorites'],['playlists','Playlists']] as const).map(([key,label]) => <button key={key} onClick={() => key === 'discovery' ? enterDiscovery() : setMode(key)} className={`rounded-full px-3 py-1.5 text-xs ${mode === key ? "bg-white text-black" : "border border-white/10 text-white/45"}`}>{label}{key === 'favorites' ? ` · ${favorites.length}` : ''}</button>)}
      </div>

      {(mode === "search" || mode === "discovery") && <div className="mt-5 flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-2"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch()} placeholder="Search songs, artists, mixtapes, vibes…" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/25" /><button disabled={busy} onClick={() => runSearch()} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40">Search</button></div>}

      {playback.track && <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:grid-cols-[112px_1fr]"><div className="aspect-square overflow-hidden rounded-xl bg-white/10">{playback.track.artworkUrl ? <img src={playback.track.artworkUrl} alt={`${playback.track.album || playback.track.title} artwork`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl text-white/20">♪</div>}</div><div className="flex min-w-0 flex-col justify-center"><p className="text-xs uppercase tracking-[.25em] text-white/30">Now Playing</p><p className="mt-2 truncate text-xl font-semibold">{playback.track.title}</p><p className="mt-1 truncate text-sm text-white/45">{playback.track.artist}{playback.track.album ? ` · ${playback.track.album}` : ""}</p><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/3 rounded-full bg-white/70" /></div><div className="mt-4 flex flex-wrap items-center gap-2"><button onClick={() => run("previous")} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60">‹</button><button onClick={() => run(playback.status === "playing" ? "pause" : "resume")} disabled={busy} className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-black">{playback.status === "playing" ? "Pause" : "Play"}</button><button onClick={() => run("next")} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60">›</button><button onClick={() => toggleFavorite(playback.track!)} className="rounded-xl border border-white/10 px-3 py-2 text-sm">{favorites.includes(playback.track.id) ? "★ Favorited" : "☆ Favorite"}</button></div></div></div>}

      {mode === "discovery" && <div className="mt-5 flex flex-wrap gap-2">{["Lil Wayne mixtapes","deep cuts southern rap","similar artists","remixes","live performances"].map(seed => <button key={seed} onClick={() => enterDiscovery(seed)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/55 hover:bg-white/5">{seed}</button>)}</div>}

      {mode === "playlists" && <div className="mt-5"><button onClick={createPlaylist} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">+ New playlist</button>{playlists.length === 0 ? <p className="mt-4 text-sm text-white/35">No playlists yet.</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{playlists.map(p => <div key={p.id} className="rounded-xl border border-white/10 p-4"><div className="flex items-center justify-between"><div><p className="font-medium">{p.name}</p><p className="text-xs text-white/35">{p.trackIds.length} tracks</p></div><button onClick={() => toggleOffline(p)} className={`rounded-full px-3 py-1 text-xs ${p.offline ? "bg-white text-black" : "border border-white/10 text-white/45"}`}>{p.offline ? "Offline ✓" : "Offline"}</button></div></div>)}</div>}</div>}

      {mode !== "playlists" && visibleResults.length > 0 && <div className="mt-6 grid gap-2 sm:grid-cols-2">{visibleResults.slice(0, 20).map(track => <div key={track.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5"><button onClick={() => playTrack(track)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/10">{track.artworkUrl ? <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/20">♪</div>}</div><span className="min-w-0"><span className="block truncate text-sm">{track.title}</span><span className="block truncate text-xs text-white/35">{track.artist}{track.album ? ` · ${track.album}` : ""}</span></span></button><button onClick={() => toggleFavorite(track)} aria-label="Favorite" className="px-2 text-lg">{favorites.includes(track.id) ? "★" : "☆"}</button>{playlists.length > 0 && <select onChange={e => { if (e.target.value) addToPlaylist(track, e.target.value); e.currentTarget.value = ""; }} className="max-w-28 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/60"><option value="">+ Playlist</option>{playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div>)}</div>}

      {message && <p className="mt-4 text-xs text-white/45">{message}</p>}
      <p className="mt-5 text-[11px] leading-5 text-white/25">Offline storage is reserved for music you own or are licensed to use. Discovery can surface authorized/public playback sources without treating unofficial uploads as downloadable assets.</p>
    </section>
  );
}
