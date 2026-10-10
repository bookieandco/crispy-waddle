"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  addToQueue,
  createPlaybackState,
  cycleRepeat,
  nextTrack,
  playTrack,
  previousTrack,
  removeFromQueue,
  reorderQueue,
  restorePlayerState,
  serializePlayerState,
  toggleShuffle,
  type PlaybackState,
  playbackTicketNeedsRefresh,
  type PlaybackTicket,
} from "@jhadina/music-core";
import { AudioPlaybackBridge } from "./AudioPlaybackBridge";
import { MUSIC_PLAYER_EVENT, type MusicPlayerCommand } from "@/lib/music/music-player-bus";

const PLAYER_KEY = "jhadina.music.player.v2:";

export function PersistentMusicPlayer() {
  const pathname = usePathname();
  const [playback, setPlayback] = useState<PlaybackState>(() => createPlaybackState());
  // Short-lived playback tickets stay in memory only, never in localStorage or event payloads.
  const [ticket, setTicket] = useState<PlaybackTicket | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const listeningSession = useRef<{ trackId: string; sessionId: string; startedAt: string } | null>(null);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      try {
        const response = await fetch("/api/music/session", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as { data?: { userId?: string } };
        const id = body.data?.userId;
        if (!active || !id) return;
        setUserId(id);
        localStorage.removeItem("jhadina.music.sources.v1");
        localStorage.removeItem("jhadina.music.player.v1");
        try {
          setPlayback(restorePlayerState(JSON.parse(localStorage.getItem(PLAYER_KEY + id) || "null")));
        } catch {
          setPlayback(createPlaybackState());
        }
      } catch {
        // Auth/database unavailable: do not surface another person's cached queue.
      } finally {
        if (active) setHydrated(true);
      }
    }
    void hydrate();
    return () => { active = false; };
  }, []);

  // Revalidate identity as the shell navigates, including after sign-out or account switching.
  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    void fetch("/api/music/session", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ data?: { userId?: string } }> : null)
      .then((body) => {
        if (!active) return;
        const nextUser = body?.data?.userId ?? null;
        if (nextUser === userId) return;
        setUserId(nextUser);
        listeningSession.current = null;
        setTicket(null);
        setQueueOpen(false);
        if (!nextUser) { setPlayback(createPlaybackState()); return; }
        try {
          setPlayback(restorePlayerState(JSON.parse(localStorage.getItem(PLAYER_KEY + nextUser) || "null")));
        } catch { setPlayback(createPlaybackState()); }
      })
      .catch(() => {
        if (active) {
          setUserId(null);
          listeningSession.current = null;
          setPlayback(createPlaybackState());
          setTicket(null);
        }
      });
    return () => { active = false; };
    // Navigation, rather than player-state changes, triggers identity revalidation.
  }, [pathname, hydrated]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    try { localStorage.setItem(PLAYER_KEY + userId, JSON.stringify(serializePlayerState(playback))); }
    catch { /* Private browsing or quota errors must not stop playback. */ }
  }, [hydrated, userId, playback]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    function onCommand(event: Event) {
      const command = (event as CustomEvent<MusicPlayerCommand>).detail;
      if (!command) return;
      if (command.type === "pause") { setPlayback(state => ({ ...state, playing: false })); return; }
      if (command.type === "resume") { setPlayback(state => state.track ? { ...state, playing: true } : state); return; }
      if (!command.track?.id) return;
      setPlayerError(null);
      setPlayback(state => {
        const queued = addToQueue(state, command.track, command.type === "queue" ? command.mode ?? "last" : "last");
        return command.type === "queue" ? queued : playTrack(queued, command.track);
      });
    }
    window.addEventListener(MUSIC_PLAYER_EVENT, onCommand);
    return () => window.removeEventListener(MUSIC_PLAYER_EVENT, onCommand);
  }, [hydrated, userId]);

  // Resolve against the authenticated owner on track selection and on renewal requests.
  useEffect(() => {
    const trackId = playback.track?.id;
    if (!hydrated || !userId || !trackId) return;
    const abort = new AbortController();
    void fetch(`/api/music/playback?trackId=${encodeURIComponent(trackId)}`, {
      cache: "no-store", signal: abort.signal,
    }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404
        ? "This track has no current playback authorization" : "Audio source is unavailable");
      return response.json() as Promise<{ data?: PlaybackTicket }>;
    }).then(body => {
      if (abort.signal.aborted) return;
      if (!body.data?.sourceUri || body.data.trackId !== trackId) throw new Error("Invalid playback ticket");
      setTicket(body.data);
      setPlayerError(null);
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return;
      setTicket(null);
      setPlayerError(error instanceof Error ? error.message : "Unable to play track");
      setPlayback(state => state.track?.id === trackId ? { ...state, playing: false } : state);
    });
    return () => abort.abort();
  }, [hydrated, userId, playback.track?.id, refreshRevision]);

  useEffect(() => {
    if (!ticket?.expiresAt) return;
    // Check regularly; browsers throttle background timers and must recheck on foreground return.
    const check = () => {
      if (playbackTicketNeedsRefresh(ticket, Date.now(), 30000)) {
        setRefreshRevision(revision => revision + 1);
      }
    };
    const interval = window.setInterval(check, 20000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", check); };
  }, [ticket?.trackId, ticket?.sourceUri, ticket?.expiresAt]);

  // Never keep a URL active for a different queue entry or after its stated expiry.
  const sourceUri = playback.track?.id === ticket?.trackId
    && !playbackTicketNeedsRefresh(ticket, Date.now(), 0) ? ticket.sourceUri : undefined;
  const progress = playback.track?.durationMs ? Math.min(100, playback.positionMs / playback.track.durationMs * 100) : 0;
  const artist = useMemo(() => playback.track?.artistIds.join(" · ") || "Jhadina Music", [playback.track]);

  useEffect(() => {
    if (!hydrated || !userId || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (playback.track) session.metadata = new MediaMetadata({ title: playback.track.title, artist });
    const action = (name: MediaSessionAction, fn: (details: MediaSessionActionDetails) => void) => { try { session.setActionHandler(name, fn); } catch { /* unsupported */ } };
    action("play", () => setPlayback((state) => state.track ? { ...state, playing: true } : state));
    action("pause", () => setPlayback((state) => ({ ...state, playing: false })));
    action("nexttrack", () => setPlayback((state) => nextTrack(state)));
    action("previoustrack", () => setPlayback((state) => state.positionMs > 5000 ? { ...state, positionMs: 0 } : previousTrack(state)));
    action("seekto", (details) => {
      if (typeof details.seekTime !== "number" || !Number.isFinite(details.seekTime)) return;
      setPlayback((state) => ({ ...state, positionMs: Math.min(state.track?.durationMs ?? Infinity, Math.max(0, Math.round(details.seekTime! * 1000))) }));
    });
    return () => {
      for (const name of ["play", "pause", "nexttrack", "previoustrack", "seekto"] as MediaSessionAction[]) {
        try { session.setActionHandler(name, null); } catch { /* unsupported */ }
      }
    };
  }, [hydrated, userId, artist, playback.track?.id, playback.positionMs]);

  return (
    <>
      <AudioPlaybackBridge playback={playback} sourceUri={sourceUri}
        onPosition={(positionMs) => setPlayback((state) => Math.abs(state.positionMs - positionMs) < 500 ? state : { ...state, positionMs })}
        onError={() => {
          setTicket(null);
          setRefreshRevision(revision => revision + 1);
        }}
        onStarted={() => {
          if (!playback.track || !userId) return;
          if (listeningSession.current?.trackId !== playback.track.id) {
            listeningSession.current = {
              trackId: playback.track.id, sessionId: crypto.randomUUID(), startedAt: new Date().toISOString(),
            };
          }
        }}
        onEnded={() => {
          const ended = listeningSession.current;
          listeningSession.current = null;
          if (ended && ended.trackId === playback.track?.id && userId) {
            // Operational listening history only: never a verified DSP/royalty stream count.
            void fetch("/api/music/listens", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...ended, positionMs: Math.max(0, playback.track.durationMs ?? playback.positionMs),
              }),
            }).catch(() => { /* Listening history must not interrupt audio. */ });
          }
          setPlayback((state) => nextTrack(state));
        }} />
      {hydrated && userId && playback.track && <>
        {playerError && <div role="alert" className="fixed bottom-[90px] left-4 z-50 rounded-xl bg-[#261415] px-4 py-2 text-sm text-amber-200">{playerError}</div>}
        {queueOpen && <aside className="fixed bottom-[88px] right-4 z-50 w-[min(420px,calc(100vw-32px))] rounded-3xl border border-white/10 bg-[#101116]/95 p-5 text-white shadow-2xl backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between"><strong>Up Next</strong><button onClick={() => setQueueOpen(false)} className="text-sm text-white/45">Close</button></div>
          <div className="max-h-[55vh] space-y-2 overflow-auto">{playback.queue.map((track, index) => <div key={track.id} className={`flex items-center gap-2 rounded-xl p-2 ${index === playback.queueIndex ? "bg-white/10" : ""}`}>
            <button onClick={() => setPlayback((state) => playTrack(state, track))} className="min-w-0 flex-1 truncate text-left text-sm">{track.title}</button>
            <button disabled={index === 0} onClick={() => setPlayback((state) => reorderQueue(state, index, index - 1))} className="px-2 text-white/40 disabled:opacity-20">↑</button>
            <button disabled={index === playback.queue.length - 1} onClick={() => setPlayback((state) => reorderQueue(state, index, index + 1))} className="px-2 text-white/40 disabled:opacity-20">↓</button>
            <button onClick={() => setPlayback((state) => removeFromQueue(state, track.id))} className="px-2 text-white/40">×</button>
          </div>)}</div>
        </aside>}
        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090a0e]/92 px-4 py-3 text-white backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-white/10"><div className="h-full bg-white/70" style={{ width: `${progress}%` }} /></div>
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">♪</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{playback.track.title}</p><p className="truncate text-xs text-white/35">{artist}</p></div>
            <button onClick={() => setPlayback((state) => toggleShuffle(state))} className={`hidden text-xs sm:block ${playback.shuffle ? "text-white" : "text-white/35"}`}>Shuffle</button>
            <button onClick={() => setPlayback((state) => previousTrack(state))} className="text-white/60">◀◀</button>
            <button onClick={() => setPlayback((state) => sourceUri ? { ...state, playing: !state.playing } : state)} disabled={!sourceUri} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black disabled:opacity-25">{playback.playing ? "Ⅱ" : "▶"}</button>
            <button onClick={() => setPlayback((state) => nextTrack(state))} className="text-white/60">▶▶</button>
            <button onClick={() => setPlayback((state) => cycleRepeat(state))} className="hidden text-xs text-white/45 md:block">Repeat: {playback.repeat}</button>
            <button onClick={() => setQueueOpen((open) => !open)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60">Queue {playback.queue.length}</button>
          </div>
        </footer>
      </>}
    </>
  );
}
