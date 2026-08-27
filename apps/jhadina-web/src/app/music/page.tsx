"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlaybackState, Track } from "@jhadina/music-core";
import { NowPlayingPanel } from "../../components/music/NowPlayingPanel";
import { createMusicCapability } from "@/lib/music/create-music-capability";

type LibraryTab = "home" | "library" | "favorites" | "recent" | "downloads" | "playlists";

export default function MusicPage() {
  const [capability, setCapability] = useState<Awaited<ReturnType<typeof createMusicCapability>>>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("home");
  const [fullPlayer, setFullPlayer] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const refreshPlayback = useCallback(async () => {
    if (!capability) return;
    const response = await capability.execute({ type: "music.status" });
    if (response.playback) setPlayback(response.playback);
  }, [capability]);

  useEffect(() => {
    let active = true;
    void createMusicCapability((state) => { if (active) setPlayback(state); }).then((nextCapability) => {
      if (!active) return;
      setCapability(nextCapability);
      if (nextCapability) void nextCapability.execute({ type: "music.status" }).then((response) => {
        if (active && response.playback) setPlayback(response.playback);
      });
    });
    return () => { active = false; };
  }, []);

  async function search() {
    const normalized = query.trim();
    if (!normalized || !capability) return;
    setLoading(true);
    try {
      const response = await capability.execute({ type: "music.search", query: normalized });
      setResults((response.results ?? []) as Track[]);
    } finally { setLoading(false); }
  }

  async function play(track: Track) {
    if (!capability) return;
    const response = await capability.execute({ type: "music.play", track });
    if (response.playback) setPlayback(response.playback);
  }

  async function togglePlay() {
    if (!capability || !playback?.queue.length) return;
    const response = await capability.execute({ type: playback.playing ? "music.pause" : "music.resume" });
    if (response.playback) setPlayback(response.playback);
  }

  async function next() {
    if (!capability) return;
    const response = await capability.execute({ type: "music.next" });
    if (response.playback) setPlayback(response.playback);
  }

  async function previous() {
    if (!capability) return;
    const response = await capability.execute({ type: "music.previous" });
    if (response.playback) setPlayback(response.playback);
  }

  const currentTrack = playback?.queue[playback.queueIndex] ?? null;
  const libraryTracks = results;

  return (
    <main className="min-h-screen bg-[#07080b] text-white">
      <div className="mx-auto max-w-7xl px-5 pb-32 pt-7 md:px-10 md:pt-10">
        <header className="mb-8">
          <p className="text-[11px] uppercase tracking-[.35em] text-white/35">Jhadina</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Music</h1>
            <nav className="flex flex-wrap gap-2 text-xs">
              {(["home", "library", "favorites", "recent", "downloads", "playlists"] as LibraryTab[]).map((item) => (
                <button key={item} onClick={() => setTab(item)} className={`rounded-full border px-3 py-2 capitalize ${tab === item ? "border-white/25 bg-white/10" : "border-white/10 text-white/40"}`}>
                  {item === "recent" ? "Recently Played" : item}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {!capability && <div className="rounded-3xl border border-white/10 bg-white/[.035] p-8 text-white/45">Sign in to use your Music library.</div>}

        {capability && tab === "home" && (
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.045] p-7 md:p-12">
            <p className="text-sm text-white/40">Ask Jhadina</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-medium leading-tight md:text-6xl">Find the music you&apos;re feeling.</h2>
            <div className="mt-8 flex max-w-3xl gap-3">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Song, artist, album..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-white/25" />
              <button onClick={() => void search()} disabled={loading} className="rounded-2xl bg-white px-5 py-4 font-medium text-black disabled:opacity-50">{loading ? "…" : "Search"}</button>
            </div>
          </section>
        )}

        {capability && (tab !== "home" || results.length > 0) && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-[11px] uppercase tracking-[.3em] text-white/30">{tab === "home" ? "Search Results" : tab}</p><h2 className="mt-2 text-2xl font-semibold">{tab === "favorites" ? "Your Favorites" : tab === "library" ? "Your Library" : tab === "downloads" ? "Available Offline" : tab === "playlists" ? "Your Playlists" : "Results"}</h2></div>
              <button onClick={() => setFavoriteIds(new Set())} className="text-xs text-white/30">Reset local favorites</button>
            </div>
            {libraryTracks.length === 0 ? <div className="rounded-3xl border border-white/10 bg-white/[.035] p-10 text-center text-white/35">Nothing here yet.</div> : <TrackList tracks={libraryTracks} favoriteIds={favoriteIds} onPlay={play} onFavorite={(id) => setFavoriteIds((current) => { const nextSet = new Set(current); if (nextSet.has(id)) nextSet.delete(id); else nextSet.add(id); return nextSet; })} />}
          </section>
        )}
      </div>

      {fullPlayer && currentTrack && (
        <div className="fixed inset-0 z-50 bg-[#07080b]/98 p-5 backdrop-blur-2xl md:p-10">
          <div className="mx-auto max-w-4xl">
            <button onClick={() => setFullPlayer(false)} className="mb-6 text-sm text-white/45">Close</button>
            <NowPlayingPanel track={currentTrack} lyrics={null} playing={Boolean(playback?.playing)} positionMs={playback?.positionMs ?? 0} favorite={favoriteIds.has(currentTrack.id)} downloaded={false} onTogglePlay={() => void togglePlay()} onSeek={() => {}} onFavorite={() => setFavoriteIds((current) => { const nextSet = new Set(current); if (nextSet.has(currentTrack.id)) nextSet.delete(currentTrack.id); else nextSet.add(currentTrack.id); return nextSet; })} onDownload={() => {}} onClose={() => setFullPlayer(false)} />
          </div>
        </div>
      )}

      {queueOpen && playback && <aside className="fixed bottom-[82px] right-5 z-40 w-[min(400px,calc(100vw-40px))] rounded-3xl border border-white/10 bg-[#101116]/95 p-5 shadow-2xl backdrop-blur-xl"><div className="mb-4 flex items-center justify-between"><h3 className="font-medium">Up Next</h3><button onClick={() => setQueueOpen(false)} className="text-white/40">Close</button></div>{playback.queue.map((track, index) => <button key={`${track.id}-${index}`} onClick={() => void play(track)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${index === playback.queueIndex ? "bg-white/10" : "hover:bg-white/5"}`}><span className="w-5 text-xs text-white/30">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm">{track.title}</span>{index === playback.queueIndex && <span className="text-xs text-white/50">Playing</span>}</button>)}</aside>}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#090a0e]/92 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button onClick={() => currentTrack && setFullPlayer(true)} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10">♪</button>
          <button onClick={() => currentTrack && setFullPlayer(true)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-medium">{currentTrack?.title ?? "Nothing playing"}</p><p className="truncate text-xs text-white/35">{currentTrack?.artistIds.join(" · ") ?? "Choose something to play"}</p></button>
          <button onClick={() => void previous()} disabled={!currentTrack} className="text-white/60 disabled:opacity-20">◀◀</button>
          <button onClick={() => void togglePlay()} disabled={!currentTrack} className="grid h-11 w-11 place-items-center rounded-full bg-white text-black disabled:opacity-30">{playback?.playing ? "Ⅱ" : "▶"}</button>
          <button onClick={() => void next()} disabled={!currentTrack} className="text-white/60 disabled:opacity-20">▶▶</button>
          <button onClick={() => setQueueOpen((open) => !open)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60">Queue {playback?.queue.length ?? 0}</button>
          <button onClick={() => void refreshPlayback()} className="hidden text-xs text-white/25 sm:block">↻</button>
        </div>
      </div>
    </main>
  );
}

function TrackList({ tracks, favoriteIds, onPlay, onFavorite }: { tracks: Track[]; favoriteIds: Set<string>; onPlay: (track: Track) => void; onFavorite: (trackId: string) => void }) {
  return <div className="space-y-2">{tracks.map((track) => <div key={track.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.035] p-4 hover:bg-white/[.07]"><button onClick={() => void onPlay(track)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">▶</button><div className="min-w-0 flex-1"><p className="truncate font-medium">{track.title}</p><p className="truncate text-sm text-white/40">{track.artistIds.join(" · ") || "Unknown artist"}</p></div><button onClick={() => onFavorite(track.id)} className={`rounded-xl px-2 ${favoriteIds.has(track.id) ? "text-white" : "text-white/30"}`}>♥</button></div>)}</div>;
}
