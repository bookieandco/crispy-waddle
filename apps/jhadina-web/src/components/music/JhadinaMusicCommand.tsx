"use client";

import { useState } from "react";

type Track = { id: string; title: string; artist: string };
type Playback = { status: "idle" | "playing" | "paused"; track?: Track };

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

  async function runSearch() {
    if (!query.trim()) return;
    setBusy(true);
    try { setResults(await search(query.trim())); } finally { setBusy(false); }
  }

  async function run(action: "play" | "pause" | "resume" | "next" | "previous") {
    setBusy(true);
    try { setPlayback(await command(action)); } finally { setBusy(false); }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.045] p-5 text-white shadow-2xl shadow-black/20 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[.35em] text-white/30">Jhadina Music</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">What are we playing?</h2></div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">{playback.status}</div>
      </div>

      <div className="mt-6 flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Search songs, artists, vibes…" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/25" />
        <button disabled={busy} onClick={runSearch} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40">Search</button>
      </div>

      {playback.track && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="font-medium">{playback.track.title}</p><p className="mt-1 text-sm text-white/40">{playback.track.artist}</p></div>}

      <div className="mt-5 flex items-center gap-2">
        <button onClick={() => run("previous")} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 disabled:opacity-30">‹</button>
        <button onClick={() => run(playback.status === "playing" ? "pause" : "resume")} disabled={busy} className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-black disabled:opacity-40">{playback.status === "playing" ? "Pause" : "Play"}</button>
        <button onClick={() => run("next")} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 disabled:opacity-30">›</button>
      </div>

      {results.length > 0 && <div className="mt-6 space-y-2">{results.slice(0, 6).map((track) => <button key={track.id} onClick={async () => { setBusy(true); try { setPlayback(await command("play")); } finally { setBusy(false); } }} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-white/5"><span><span className="block text-sm">{track.title}</span><span className="text-xs text-white/35">{track.artist}</span></span><span className="text-xs text-white/25">Play</span></button>)}</div>}
    </section>
  );
}
