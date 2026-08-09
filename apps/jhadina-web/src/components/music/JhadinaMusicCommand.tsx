"use client";

import { useState } from "react";

type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  sourceUrl?: string;
  playable?: boolean;
};

type Playback = { status: "idle" | "playing" | "paused"; track?: Track };
type Mode = "search" | "discovery";

export function JhadinaMusicCommand({
  search,
  command,
}: {
  search: (query: string) => Promise<Track[]>;
  command: (action: "play" | "pause" | "resume" | "next" | "previous") => Promise<Playback>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [playback, setPlayback] = useState<Playback>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("search");

  async function runSearch(nextQuery = query) {
    if (!nextQuery.trim()) return;
    setBusy(true);
    try { setResults(await search(nextQuery.trim())); } finally { setBusy(false); }
  }

  async function run(action: "play" | "pause" | "resume" | "next" | "previous") {
    setBusy(true);
    try { setPlayback(await command(action)); } finally { setBusy(false); }
  }

  function enterDiscovery(seed?: string) {
    setMode("discovery");
    const next = seed?.trim() || query.trim() || "Lil Wayne mixtapes deep cuts southern rap";
    setQuery(next);
    void runSearch(next);
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.045] p-5 text-white shadow-2xl shadow-black/20 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[.35em] text-white/30">Jhadina MusicOS</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{mode === "discovery" ? "Discovery Mode" : "What are we playing?"}</h2>
          <p className="mt-1 text-sm text-white/35">Search, discover, and keep your listening context in one place.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">{playback.status}</div>
      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={() => setMode("search")} className={`rounded-full px-3 py-1.5 text-xs ${mode === "search" ? "bg-white text-black" : "border border-white/10 text-white/45"}`}>Search</button>
        <button onClick={() => enterDiscovery()} className={`rounded-full px-3 py-1.5 text-xs ${mode === "discovery" ? "bg-white text-black" : "border border-white/10 text-white/45"}`}>Discovery</button>
      </div>

      <div className="mt-5 flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Search songs, artists, mixtapes, vibes…" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/25" />
        <button disabled={busy} onClick={() => runSearch()} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40">Search</button>
      </div>

      {playback.track && (
        <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:grid-cols-[112px_1fr]">
          <div className="aspect-square overflow-hidden rounded-xl bg-white/10">
            {playback.track.artworkUrl ? <img src={playback.track.artworkUrl} alt={`${playback.track.album || playback.track.title} artwork`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl text-white/20">♪</div>}
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <p className="text-xs uppercase tracking-[.25em] text-white/30">Now Playing</p>
            <p className="mt-2 truncate text-xl font-semibold">{playback.track.title}</p>
            <p className="mt-1 truncate text-sm text-white/45">{playback.track.artist}{playback.track.album ? ` · ${playback.track.album}` : ""}</p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/3 rounded-full bg-white/70" /></div>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => run("previous")} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 disabled:opacity-30">‹</button>
              <button onClick={() => run(playback.status === "playing" ? "pause" : "resume")} disabled={busy} className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-black disabled:opacity-40">{playback.status === "playing" ? "Pause" : "Play"}</button>
              <button onClick={() => run("next")} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 disabled:opacity-30">›</button>
            </div>
          </div>
        </div>
      )}

      {mode === "discovery" && (
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            "Lil Wayne mixtapes",
            "deep cuts southern rap",
            "similar artists",
            "remixes",
            "live performances",
          ].map((seed) => <button key={seed} onClick={() => enterDiscovery(seed)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/55 hover:bg-white/5">{seed}</button>)}
        </div>
      )}

      {results.length > 0 && <div className="mt-6 grid gap-2 sm:grid-cols-2">{results.slice(0, 10).map((track) => <button key={track.id} onClick={async () => { setBusy(true); try { setPlayback(await command("play")); } finally { setBusy(false); } }} className="flex items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/10">{track.artworkUrl ? <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/20">♪</div>}</div>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm">{track.title}</span><span className="block truncate text-xs text-white/35">{track.artist}{track.album ? ` · ${track.album}` : ""}</span></span>
        <span className="text-xs text-white/25">Play</span>
      </button>)}</div>}

      <p className="mt-5 text-[11px] leading-5 text-white/25">Discovery may surface authorized/public playback sources. Local import is reserved for music you own or are licensed to use.</p>
    </section>
  );
}
