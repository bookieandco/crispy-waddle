"use client";

import { useMemo, useState } from "react";
import { createMusicControllerState, enqueue, next, previous, playTrack, toggleShuffle, cycleRepeat, setOfflineOnly, type MusicControllerState, type Track, createMusicLibraryState, toggleFavorite, recordPlayed, markDownloaded, type MusicLibraryState } from "@jhadina/music-core";
import { AudioPlaybackBridge } from "../../components/music/AudioPlaybackBridge";

type Result = { track: Track; score: number; sourceUri?: string; offline?: boolean };

type LibraryTab = "home" | "library" | "favorites" | "recent" | "downloads" | "playlists";

export default function MusicPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [music, setMusic] = useState<MusicControllerState>(() => createMusicControllerState());
  const [library, setLibrary] = useState<MusicLibraryState>(() => createMusicLibraryState());
  const [sources, setSources] = useState<Record<string, string>>({});
  const [queueOpen, setQueueOpen] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("home");

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      const body = await response.json();
      const nextResults = body.data?.results ?? [];
      setResults(nextResults);
      setLibrary((current) => ({ ...current, tracks: [...new Map([...current.tracks, ...nextResults.map((item: Result) => item.track)].map((track) => [track.id, track])).values()] }));
    } finally { setLoading(false); }
  }

  function play(item: Result) {
    if (item.sourceUri) setSources((current) => ({ ...current, [item.track.id]: item.sourceUri! }));
    setLibrary((current) => recordPlayed(current, item.track.id));
    setMusic((current) => playTrack(current, item.track));
  }

  function addToQueue(item: Result) {
    if (item.sourceUri) setSources((current) => ({ ...current, [item.track.id]: item.sourceUri! }));
    setMusic((current) => enqueue(current, [item.track]));
  }

  function favorite(trackId: string) { setLibrary((current) => toggleFavorite(current, trackId)); }
  function download(trackId: string) { setLibrary((current) => markDownloaded(current, trackId)); }

  const currentTrack = music.queue[music.queueIndex];
  const sourceUri = currentTrack ? sources[currentTrack.id] : undefined;
  const favoriteIds = new Set(library.favoriteTrackIds);
  const downloadedIds = new Set(library.downloadedTrackIds);
  const visibleTracks = tab === "favorites" ? library.tracks.filter((track) => favoriteIds.has(track.id)) : tab === "recent" ? library.recentlyPlayedTrackIds.map((id) => library.tracks.find((track) => track.id === id)).filter(Boolean) as Track[] : tab === "downloads" ? library.tracks.filter((track) => downloadedIds.has(track.id)) : library.tracks;
  const subtitle = useMemo(() => currentTrack?.artistIds.join(" · ") || "Your library", [currentTrack]);
  const playbackForAudio = useMemo(() => ({ track: currentTrack ?? null, queue: music.queue, queueIndex: music.queueIndex, positionMs: music.positionMs, playing: music.playing && Boolean(sourceUri), shuffle: music.shuffle, repeat: music.repeat === "one" ? "track" as const : music.repeat === "all" ? "queue" as const : "off" as const }), [currentTrack, music, sourceUri]);

  return <main className="min-h-screen bg-[#07080b] text-white">
    <AudioPlaybackBridge playback={playbackForAudio} sourceUri={sourceUri} onPosition={(positionMs) => setMusic((current) => Math.abs(current.positionMs - positionMs) < 250 ? current : { ...current, positionMs })} onEnded={() => setMusic((current) => next(current))} />
    <div className="mx-auto max-w-7xl px-5 pb-36 pt-7 md:px-10 md:pt-10">
      <header className="mb-8"><p className="text-[11px] uppercase tracking-[.35em] text-white/35">Jhadina</p><div className="mt-2 flex flex-wrap items-end justify-between gap-5"><h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Music</h1><nav className="flex flex-wrap gap-2 text-xs">{([['home','For You'],['library','Library'],['favorites','Favorites'],['recent','Recently Played'],['downloads','Downloads'],['playlists','Playlists']] as [LibraryTab,string][]).map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-full border px-3 py-2 ${tab === id ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 text-white/40'}`}>{label}</button>)}</nav></div></header>

      {tab === "home" && <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.045] p-7 md:p-12"><p className="relative text-sm text-white/40">Ask Jhadina</p><h2 className="relative mt-3 max-w-3xl text-3xl font-medium leading-tight md:text-6xl">Find the music you&apos;re feeling.</h2><div className="relative mt-8 flex max-w-3xl gap-3"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Song, artist, album..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-white/25" /><button onClick={search} disabled={loading} className="rounded-2xl bg-white px-5 py-4 font-medium text-black disabled:opacity-50">{loading ? "…" : "Search"}</button></div></section>}

      {results.length > 0 && <section className="mt-10"><div className="mb-4 flex items-center justify-between"><p className="text-[11px] uppercase tracking-[.3em] text-white/30">Search Results</p><button onClick={() => setMusic((current) => setOfflineOnly(current, !current.offlineOnly))} className={`rounded-full border px-3 py-1.5 text-xs ${music.offlineOnly ? "border-white/30 bg-white/10" : "border-white/10 text-white/40"}`}>{music.offlineOnly ? "Offline only" : "All sources"}</button></div><TrackList tracks={results.map((item) => item.track)} favoriteIds={favoriteIds} downloadedIds={downloadedIds} onPlay={(track) => play(results.find((item) => item.track.id === track.id) ?? { track, score: 1 })} onQueue={(track) => addToQueue(results.find((item) => item.track.id === track.id) ?? { track, score: 1 })} onFavorite={favorite} onDownload={download} /></section>}

      {tab !== "home" && <section className="mt-8"><div className="mb-5 flex items-end justify-between"><div><p className="text-[11px] uppercase tracking-[.3em] text-white/30">{tab}</p><h2 className="mt-2 text-3xl font-semibold">{tab === "favorites" ? "Your Favorites" : tab === "recent" ? "Recently Played" : tab === "downloads" ? "Available Offline" : tab === "playlists" ? "Your Playlists" : "Your Library"}</h2></div></div>{tab === "playlists" ? <div className="rounded-3xl border border-white/10 bg-white/[.035] p-8 text-white/40">Playlists are ready for provider sync in the next library slice.</div> : <TrackList tracks={visibleTracks} favoriteIds={favoriteIds} downloadedIds={downloadedIds} onPlay={play} onQueue={addToQueue} onFavorite={favorite} onDownload={download} />}</section>}

      {tab === "home" && <section className="mt-12 grid gap-4 md:grid-cols-4">{[['For You','Music shaped by your approved taste profile.'],['Recently Played',`${library.recentlyPlayedTrackIds.length} tracks in your listening history.`],['Your Library',`${library.tracks.length} songs currently indexed.`],['Offline',`${library.downloadedTrackIds.length} tracks marked available offline.`]].map(([title,text]) => <button key={title} onClick={() => setTab(title === 'For You' ? 'home' : title === 'Recently Played' ? 'recent' : title === 'Your Library' ? 'library' : 'downloads')} className="rounded-[1.5rem] border border-white/8 bg-white/[.035] p-6 text-left hover:bg-white/[.06]"><p className="text-lg font-medium">{title}</p><p className="mt-2 text-sm leading-6 text-white/40">{text}</p></button>)}</section>}
    </div>

    {queueOpen && <aside className="fixed bottom-[82px] right-5 z-40 w-[min(400px,calc(100vw-40px))] rounded-3xl border border-white/10 bg-[#101116]/95 p-5 shadow-2xl backdrop-blur-xl"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-medium">Up Next</h3><p className="text-xs text-white/30">{Math.max(0, music.queue.length - music.queueIndex - 1)} tracks</p></div><button onClick={() => setQueueOpen(false)} className="text-white/40">Close</button></div>{music.queue.map((track, index) => <button key={track.id} onClick={() => play(track)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${index === music.queueIndex ? "bg-white/10" : "hover:bg-white/5"}`}><span className="w-5 text-xs text-white/30">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm">{track.title}</span>{index === music.queueIndex && <span className="text-xs text-white/50">Playing</span>}</button>)}</aside>}

    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#090a0e]/92 px-4 py-3 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10">♪</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{currentTrack?.title ?? "Nothing playing"}</p><p className="truncate text-xs text-white/35">{subtitle}</p></div><button onClick={() => setMusic((current) => toggleShuffle(current))} disabled={!currentTrack} className={`hidden rounded-xl px-2 text-xs sm:block ${music.shuffle ? "text-white" : "text-white/30"}`}>↝</button><button onClick={() => setMusic((current) => previous(current))} disabled={!currentTrack} className="text-white/60 disabled:opacity-20">◀◀</button><button onClick={() => setMusic((current) => ({ ...current, playing: !current.playing }))} disabled={!currentTrack || !sourceUri} className="grid h-11 w-11 place-items-center rounded-full bg-white text-black disabled:opacity-30">{music.playing ? "Ⅱ" : "▶"}</button><button onClick={() => setMusic((current) => next(current))} disabled={!currentTrack} className="text-white/60 disabled:opacity-20">▶▶</button><button onClick={() => setMusic((current) => cycleRepeat(current))} disabled={!currentTrack} className="hidden rounded-xl px-2 text-xs text-white/40 sm:block">{music.repeat === "one" ? "↻1" : music.repeat === "all" ? "↻" : "↻·"}</button><button onClick={() => setQueueOpen(!queueOpen)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60">Queue {music.queue.length}</button></div></div>
  </main>;
}

function TrackList({ tracks, favoriteIds, downloadedIds, onPlay, onQueue, onFavorite, onDownload }: { tracks: Track[]; favoriteIds: Set<string>; downloadedIds: Set<string>; onPlay: (track: Track) => void; onQueue: (track: Track) => void; onFavorite: (trackId: string) => void; onDownload: (trackId: string) => void }) {
  if (tracks.length === 0) return <div className="rounded-3xl border border-white/10 bg-white/[.035] p-10 text-center text-white/35">Nothing here yet.</div>;
  return <div className="space-y-2">{tracks.map((track) => <div key={track.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.035] p-4 hover:bg-white/[.07]"><button onClick={() => onPlay(track)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">▶</button><div className="min-w-0 flex-1"><p className="truncate font-medium">{track.title}</p><p className="truncate text-sm text-white/40">{track.artistIds.join(" · ") || "Unknown artist"}</p></div><button onClick={() => onFavorite(track.id)} className={`rounded-xl px-2 ${favoriteIds.has(track.id) ? "text-white" : "text-white/30"}`}>♥</button><button onClick={() => onDownload(track.id)} className={`rounded-xl px-2 text-xs ${downloadedIds.has(track.id) ? "text-white" : "text-white/30"}`}>{downloadedIds.has(track.id) ? "Offline" : "↓"}</button><button onClick={() => onQueue(track)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50">Queue</button></div>)}</div>;
}
