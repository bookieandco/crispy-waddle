"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addToQueue,
  createPlaybackState,
  cycleRepeat,
  nextTrack,
  previousTrack,
  removeFromQueue,
  reorderQueue,
  restorePlayerState,
  serializePlayerState,
  toggleShuffle,
  type PlaybackState,
  type Track,
} from "@jhadina/music-core";
import { AudioPlaybackBridge } from "./AudioPlaybackBridge";

const PLAYER_KEY = "jhadina.music.player.v1";
const SOURCE_KEY = "jhadina.music.sources.v1";

export type MusicPlayerCommand =
  | { type: "play"; track: Track; sourceUri?: string }
  | { type: "queue"; track: Track; sourceUri?: string; mode?: "last" | "next" }
  | { type: "pause" }
  | { type: "resume" };

export function PersistentMusicPlayer({ command }: { command?: MusicPlayerCommand | null }) {
  const [playback, setPlayback] = useState<PlaybackState>(() => createPlaybackState());
  const [sources, setSources] = useState<Record<string, string>>({});
  const [queueOpen, setQueueOpen] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      setPlayback(restorePlayerState(JSON.parse(localStorage.getItem(PLAYER_KEY) || "null")));
      setSources(JSON.parse(localStorage.getItem(SOURCE_KEY) || "{}"));
    } catch { /* corrupt local state fails closed */ }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem(PLAYER_KEY, JSON.stringify(serializePlayerState(playback)));
    localStorage.setItem(SOURCE_KEY, JSON.stringify(sources));
  }, [playback, sources]);

  useEffect(() => {
    if (!command) return;
    if (command.type === "pause") setPlayback((state) => ({ ...state, playing: false }));
    else if (command.type === "resume") setPlayback((state) => state.track ? { ...state, playing: true } : state);
    else {
      if (command.sourceUri) setSources((current) => ({ ...current, [command.track.id]: command.sourceUri! }));
      setPlayback((state) => {
        const queued = addToQueue(state, command.track, command.type === "queue" ? command.mode ?? "last" : "last");
        if (command.type === "queue") return queued;
        const index = queued.queue.findIndex((item) => item.id === command.track.id);
        return { ...queued, track: command.track, queueIndex: index, positionMs: 0, playing: true };
      });
    }
  }, [command]);

  const sourceUri = playback.track ? sources[playback.track.id] : undefined;
  const progress = playback.track?.durationMs ? Math.min(100, playback.positionMs / playback.track.durationMs * 100) : 0;
  const artist = useMemo(() => playback.track?.artistIds.join(" · ") || "Jhadina Music", [playback.track]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (playback.track) session.metadata = new MediaMetadata({ title: playback.track.title, artist });
    const action = (name: MediaSessionAction, fn: () => void) => { try { session.setActionHandler(name, fn); } catch { /* unsupported */ } };
    action("play", () => setPlayback((state) => state.track ? { ...state, playing: true } : state));
    action("pause", () => setPlayback((state) => ({ ...state, playing: false })));
    action("nexttrack", () => setPlayback((state) => nextTrack(state)));
    action("previoustrack", () => setPlayback((state) => state.positionMs > 5000 ? { ...state, positionMs: 0 } : previousTrack(state)));
    action("seekto", () => undefined);
    return () => { for (const name of ["play","pause","nexttrack","previoustrack"] as MediaSessionAction[]) try { session.setActionHandler(name, null); } catch {} };
  }, [artist, playback.track?.id, playback.positionMs]);

  return (
    <>
      <AudioPlaybackBridge playback={playback} sourceUri={sourceUri} onPosition={(positionMs) => setPlayback((state) => Math.abs(state.positionMs - positionMs) < 500 ? state : { ...state, positionMs })} onEnded={() => setPlayback((state) => nextTrack(state))} />
      {queueOpen && <aside className="fixed bottom-[88px] right-4 z-50 w-[min(420px,calc(100vw-32px))] rounded-3xl border border-white/10 bg-[#101116]/95 p-5 text-white shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between"><strong>Up Next</strong><button onClick={() => setQueueOpen(false)} className="text-sm text-white/45">Close</button></div>
        <div className="max-h-[55vh] space-y-2 overflow-auto">{playback.queue.map((track, index) => <div key={track.id} className={`flex items-center gap-2 rounded-xl p-2 ${index === playback.queueIndex ? "bg-white/10" : ""}`}>
          <button onClick={() => setPlayback((state) => ({ ...state, track, queueIndex: index, positionMs: 0, playing: true }))} className="min-w-0 flex-1 truncate text-left text-sm">{track.title}</button>
          <button disabled={index === 0} onClick={() => setPlayback((state) => reorderQueue(state, index, index - 1))} className="px-2 text-white/40 disabled:opacity-20">↑</button>
          <button disabled={index === playback.queue.length - 1} onClick={() => setPlayback((state) => reorderQueue(state, index, index + 1))} className="px-2 text-white/40 disabled:opacity-20">↓</button>
          <button onClick={() => setPlayback((state) => removeFromQueue(state, track.id))} className="px-2 text-white/40">×</button>
        </div>)}</div>
      </aside>}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090a0e]/92 px-4 py-3 text-white backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-white/10"><div className="h-full bg-white/70" style={{ width: `${progress}%` }} /></div>
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">♪</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{playback.track?.title ?? "Nothing playing"}</p><p className="truncate text-xs text-white/35">{artist}</p></div>
          <button onClick={() => setPlayback((state) => toggleShuffle(state))} className={`hidden text-xs sm:block ${playback.shuffle ? "text-white" : "text-white/35"}`}>Shuffle</button>
          <button onClick={() => setPlayback((state) => state.positionMs > 5000 ? { ...state, positionMs: 0 } : previousTrack(state))} disabled={!playback.track} className="text-white/60 disabled:opacity-20">◀◀</button>
          <button onClick={() => setPlayback((state) => state.track && sourceUri ? { ...state, playing: !state.playing } : state)} disabled={!playback.track || !sourceUri} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black disabled:opacity-25">{playback.playing ? "Ⅱ" : "▶"}</button>
          <button onClick={() => setPlayback((state) => nextTrack(state))} disabled={!playback.track} className="text-white/60 disabled:opacity-20">▶▶</button>
          <button onClick={() => setPlayback((state) => cycleRepeat(state))} className="hidden text-xs text-white/45 md:block">Repeat: {playback.repeat}</button>
          <button onClick={() => setQueueOpen((open) => !open)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60">Queue {playback.queue.length}</button>
        </div>
      </footer>
    </>
  );
}
