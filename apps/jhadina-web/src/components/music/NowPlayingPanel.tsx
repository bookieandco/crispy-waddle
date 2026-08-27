"use client";

import { useState } from "react";
import type { Lyrics, Track } from "@jhadina/music-core";

export function NowPlayingPanel({ track, lyrics, playing, positionMs, durationMs, favorite, downloaded, onTogglePlay, onSeek, onFavorite, onDownload, onClose }: { track: Track; lyrics?: Lyrics | null; playing: boolean; positionMs: number; durationMs?: number; favorite: boolean; downloaded: boolean; onTogglePlay: () => void; onSeek: (positionMs: number) => void; onFavorite: () => void; onDownload: () => void; onClose: () => void; }) {
  const [showLyrics, setShowLyrics] = useState(false);
  const duration = Math.max(1, durationMs ?? 0);
  const position = Math.min(Math.max(positionMs, 0), duration);

  return <section className="fixed inset-0 z-[60] overflow-y-auto bg-[#07080b] text-white">
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-6 py-6 md:px-12 md:py-10">
      <div className="flex items-center justify-between"><button onClick={onClose} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60">↓ Minimize</button><span className="text-[10px] uppercase tracking-[.35em] text-white/30">Jhadina Music</span><span className="w-20" /></div>
      <div className="flex flex-1 flex-col items-center justify-center py-10">
        <div className="grid aspect-square w-[min(72vw,420px)] place-items-center rounded-[2rem] bg-white/10 text-7xl shadow-2xl">♪</div>
        <div className="mt-8 w-full max-w-xl text-center"><p className="truncate text-3xl font-semibold md:text-4xl">{track.title}</p><p className="mt-2 truncate text-lg text-white/40">{track.artistIds.join(" · ") || "Unknown artist"}</p></div>
        <div className="mt-8 w-full max-w-xl"><input aria-label="Seek" type="range" min={0} max={duration} value={position} onChange={(e) => onSeek(Number(e.target.value))} className="w-full" /><div className="mt-1 flex justify-between text-xs text-white/30"><span>{formatMs(position)}</span><span>{formatMs(duration)}</span></div></div>
        <div className="mt-7 flex items-center gap-5"><button onClick={onFavorite} aria-label="Favorite" className={`text-2xl ${favorite ? "text-white" : "text-white/30"}`}>♥</button><button onClick={onTogglePlay} className="grid h-16 w-16 place-items-center rounded-full bg-white text-xl text-black">{playing ? "Ⅱ" : "▶"}</button><button onClick={onDownload} aria-label="Download" className={`text-sm ${downloaded ? "text-white" : "text-white/30"}`}>{downloaded ? "Offline" : "↓"}</button></div>
        <div className="mt-8 flex gap-2"><button onClick={() => setShowLyrics(!showLyrics)} className={`rounded-full border px-4 py-2 text-xs ${showLyrics ? "border-white/30 bg-white/10" : "border-white/10 text-white/50"}`}>Lyrics</button><button className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50">Queue</button><button className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50">Output</button></div>
        {showLyrics && <div className="mt-8 w-full max-w-xl rounded-3xl border border-white/10 bg-white/[.035] p-6 text-left">{lyrics ? <p className="whitespace-pre-wrap leading-8 text-white/75">{"text" in lyrics ? String((lyrics as { text?: string }).text ?? "Lyrics available") : "Lyrics available"}</p> : <p className="text-sm text-white/35">Lyrics are not available for this track yet.</p>}</div>}
      </div>
    </div>
  </section>;
}

function formatMs(value: number) { const seconds = Math.floor(value / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
