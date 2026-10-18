"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { acquireJhadinaMediaFocus, listenForOtherMediaFocus } from "./media-focus";
import { localMusicFileError, localMusicTitle, LOCAL_MUSIC_MAX_BATCH } from "@/lib/music/local-music-rules";

const DATABASE = "jhadina-local-music-v1";
const STORE = "audio";
const OPEN = "jhadina:open-local-music";

interface StoredAudio { id: string; name: string; type: string; size: number; addedAt: number; blob: Blob; }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("Browser file storage is unavailable.")); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open music storage."));
    request.onblocked = () => reject(new Error("Local Music storage is open in another tab."));
    request.onsuccess = () => resolve(request.result);
  });
}
async function loadStored(): Promise<StoredAudio[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as StoredAudio[]).sort((a,b) => b.addedAt - a.addedAt));
      request.onerror = () => reject(request.error ?? new Error("Could not read local music."));
    });
  } finally { db.close(); }
}
async function saveStored(track: StoredAudio): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(track);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Not enough storage for this audio file."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Audio save was canceled."));
    });
  } finally { db.close(); }
}
async function deleteStored(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Cannot remove this audio file."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Removal was canceled."));
    });
  } finally { db.close(); }
}

/** One audio host in the persistent shell; files never leave this browser or reach Jhadina API routes. */
export function LocalMusicPlayer() {
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<StoredAudio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrl = useRef<string | null>(null);
  const selectedId = useRef<string | null>(null);
  const trackList = useRef<StoredAudio[]>([]);

  useEffect(() => { trackList.current = tracks; }, [tracks]);
  const refresh = useCallback(async () => {
    try {
      setTracks(await loadStored());
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Storage unavailable. Your files are still on your device.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN, show);
    return () => window.removeEventListener(OPEN, show);
  }, []);
  useEffect(() => listenForOtherMediaFocus("local", () => audioRef.current?.pause()), []);
  useEffect(() => () => {
    audioRef.current?.pause();
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
  }, []);

  function play(track: StoredAudio) {
    const audio = audioRef.current;
    if (!audio) return;
    setMessage(null);
    if (selectedId.current !== track.id) {
      audio.pause();
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
      const url = URL.createObjectURL(track.blob);
      activeUrl.current = url;
      selectedId.current = track.id;
      setActiveId(track.id);
      audio.src = url;
      audio.load();
    }
    acquireJhadinaMediaFocus("local");
    void audio.play().catch(() => { setPlaying(false); setMessage("Tap Play to start audio on this device."); });
    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: localMusicTitle(track.name), artist: "Local Library" }); }
      catch { /* Media Session is optional. */ }
    }
  }

  function next(direction: number) {
    const ordered = trackList.current;
    if (!ordered.length) return;
    const index = ordered.findIndex(t => t.id === selectedId.current);
    const nextIndex = index < 0 ? 0 : (index + direction + ordered.length) % ordered.length;
    play(ordered[nextIndex]);
  }
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => { const audio = audioRef.current; if (audio) void audio.play().catch(() => undefined); }],
      ["pause", () => audioRef.current?.pause()],
      ["nexttrack", () => next(1)],
      ["previoustrack", () => next(-1)],
    ];
    for (const [name, handler] of actions) {
      try { navigator.mediaSession.setActionHandler(name, handler); } catch { /* unsupported */ }
    }
    return () => { for (const [name] of actions) {
      try { navigator.mediaSession.setActionHandler(name, null); } catch { /* unsupported */ }
    } };
  }, [tracks]);

  async function importFiles(list: FileList | null) {
    if (!list?.length) return;
    if (list.length > LOCAL_MUSIC_MAX_BATCH) {
      setMessage("Choose 20 files or fewer at a time."); return;
    }
    setBusy(true);
    let saved = 0;
    let rejection: string | null = null;
    try {
      for (const file of Array.from(list)) {
        const invalid = localMusicFileError(file);
        if (invalid) { rejection = invalid; continue; }
        try {
          await saveStored({
            id: crypto.randomUUID(), name: file.name, type: file.type,
            size: file.size, addedAt: Date.now() + saved, blob: file,
          });
          saved += 1;
        } catch (error) {
          rejection = error instanceof Error ? error.message : "Not enough storage.";
          break;
        }
      }
      setTracks(await loadStored());
      setMessage(saved ? saved + " audio file" + (saved === 1 ? "" : "s") + " saved on this device." + (rejection ? " " + rejection : "")
        : (rejection ?? "No files added."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save audio.");
    } finally { setBusy(false); }
  }

  async function remove(track: StoredAudio) {
    if (selectedId.current === track.id) {
      audioRef.current?.pause();
      audioRef.current?.removeAttribute("src");
      audioRef.current?.load();
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
      activeUrl.current = null;
      selectedId.current = null;
      setActiveId(null);
      setPlaying(false);
    }
    try { await deleteStored(track.id); setTracks(await loadStored()); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete local audio."); }
  }
  const current = tracks.find(t => t.id === activeId);
  const matches = tracks.filter(t => t.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <audio ref={audioRef} preload="metadata" onPlay={() => { acquireJhadinaMediaFocus("local"); setPlaying(true); }}
      onPause={() => setPlaying(false)} onEnded={() => next(1)} onError={() => setMessage("This file format cannot be played by this browser.")} />
    {open && <section role="dialog" aria-modal="false" aria-label="Local Music player" className="fixed inset-x-2 bottom-24 z-[70] mx-auto max-w-lg rounded-3xl border border-white/20 bg-[#101116] p-4 text-white shadow-2xl sm:inset-x-5" style={{maxHeight:"min(80dvh,640px)"}}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Local Music</h2><p className="text-xs text-white/45">Private files on this browser only</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close local music" className="rounded-full border border-white/20 px-3 py-2 text-sm">Close</button>
      </header>
      <label className="mb-3 block rounded-2xl border border-dashed border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm">
        <strong>Select audio from iPhone Files</strong>
        <span className="mt-1 block text-xs text-white/60">MP3/M4A/WAV and supported audio · max 100 MB each, 20 at a time</span>
        <input type="file" accept="audio/*,.mp3,.m4a,.flac,.wav,.aac,.ogg" multiple
          disabled={busy} onChange={e => { void importFiles(e.currentTarget.files); e.currentTarget.value = ""; }}
          className="mt-3 block w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2 file:text-black" />
      </label>
      {message && <p role="status" className="my-2 text-xs text-amber-200">{message}</p>}
      <p className="mb-3 text-xs text-white/40">Files are stored in this browser's local storage, not the cloud. iOS may remove browser data; keep original copies.</p>
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your files"
        aria-label="Search local files" className="mb-3 w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none" />
      <div className="space-y-1 overflow-y-auto" style={{maxHeight:"min(29dvh,260px)"}}>
        {loading && <p className="text-sm text-white/50">Reading local audio…</p>}
        {!loading && !matches.length && <p className="text-sm text-white/50">{tracks.length ? "No matching tracks." : "Select your own audio files to begin."}</p>}
        {matches.map(track => <div key={track.id} className={"flex items-center gap-2 rounded-xl p-2 " + (activeId === track.id ? "bg-white/15" : "bg-white/[.05]")}>
          <button type="button" onClick={() => play(track)} className="min-w-0 flex-1 truncate text-left text-sm" aria-label={"Play " + localMusicTitle(track.name)}>▶ {localMusicTitle(track.name)}</button>
          <button type="button" onClick={() => void remove(track)} className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/60" aria-label={"Remove " + track.name}>Remove</button>
        </div>)}
      </div>
      <div className="mt-3 border-t border-white/15 pt-3">
        <p className="mb-2 truncate text-sm font-medium">{current ? localMusicTitle(current.name) : "Nothing playing"}</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!tracks.length} onClick={() => next(-1)} className="rounded-xl border border-white/20 px-3 py-2 text-sm disabled:opacity-30">◀◀</button>
          <button type="button" disabled={!current} onClick={() => { const audio=audioRef.current; if(!audio) return; if(audio.paused) void audio.play().catch(() => setMessage("Tap Play again on this iPhone.")); else audio.pause(); }}
            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black disabled:opacity-30">{playing ? "Pause" : "Play"}</button>
          <button type="button" disabled={!tracks.length} onClick={() => next(1)} className="rounded-xl border border-white/20 px-3 py-2 text-sm disabled:opacity-30">▶▶</button>
          <span className="ml-auto text-xs text-white/40">{tracks.length} local tracks</span>
        </div>
        <p className="mt-2 text-xs text-white/40">Bluetooth/AirPlay uses your iPhone's available audio output controls.</p>
      </div>
    </section>}
    {!open && current && <button type="button" onClick={() => setOpen(true)}
      className="fixed bottom-24 left-3 z-[65] max-w-[80vw] truncate rounded-full border border-white/20 bg-[#101116] px-4 py-2 text-xs text-white shadow-xl">
      ♪ {localMusicTitle(current.name)} · {playing ? "Playing" : "Paused"}
    </button>}
  </>;
}
