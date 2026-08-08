"use client";

import { useMemo, useState } from "react";

type Result = { track: { id: string; title: string; artistIds: string[] }; score: number };

export default function MusicPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [queue, setQueue] = useState<Result[]>([]);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      const body = await response.json();
      setResults(body.data?.results ?? []);
    } finally { setLoading(false); }
  }

  function play(item: Result) {
    setSelected(item);
    setPlaying(true);
    setQueue((current) => current.some((x) => x.track.id === item.track.id) ? current : [...current, item]);
  }

  const subtitle = useMemo(() => selected ? selected.track.artistIds.join(" · ") || "Your library" : "Choose something to start your session", [selected]);

  return (
    <main className="min-h-screen bg-[#07080b] text-white">
      <div className="mx-auto max-w-7xl px-5 pb-32 pt-7 md:px-10 md:pt-10">
        <header className="mb-10 flex items-end justify-between">
          <div><p className="text-[11px] uppercase tracking-[.35em] text-white/35">Jhadina</p><h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">Music</h1></div>
          <div className="hidden rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-xs text-white/50 md:block">Personal Music OS</div>
        </header>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.045] p-7 md:p-12">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <p className="relative text-sm text-white/40">Ask Jhadina</p>
          <h2 className="relative mt-3 max-w-3xl text-3xl font-medium leading-tight md:text-6xl">Find the music you&apos;re feeling.</h2>
          <div className="relative mt-8 flex max-w-3xl gap-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Song, artist, album..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-white/25 focus:border-white/25" />
            <button onClick={search} disabled={loading} className="rounded-2xl bg-white px-5 py-4 font-medium text-black disabled:opacity-50">{loading ? "…" : "Search"}</button>
          </div>
        </section>

        {results.length > 0 && <section className="mt-10"><p className="mb-4 text-[11px] uppercase tracking-[.3em] text-white/30">Results</p><div className="space-y-2">{results.map((item) => <button key={item.track.id} onClick={() => play(item)} className="flex w-full items-center gap-4 rounded-2xl border border-white/5 bg-white/[.035] p-4 text-left hover:bg-white/[.07]"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-lg">♪</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.track.title}</p><p className="truncate text-sm text-white/40">{item.track.artistIds.join(" · ") || "Unknown artist"}</p></div><span className="text-xs text-white/25">{Math.round(item.score * 100)}%</span><span className="text-white/60">▶</span></button>)}</div></section>}

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {[['For You','Music shaped by your approved taste profile.'],['Recently Played','Your listening history, not an algorithmic guess.'],['Your Library',`${queue.length} queued track${queue.length === 1 ? '' : 's'}`]].map(([title,text]) => <article key={title} className="rounded-[1.5rem] border border-white/8 bg-white/[.035] p-6 hover:bg-white/[.06]"><p className="text-lg font-medium">{title}</p><p className="mt-2 text-sm leading-6 text-white/40">{text}</p></article>)}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#090a0e]/90 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10">♪</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{selected?.track.title ?? 'Nothing playing'}</p><p className="truncate text-xs text-white/35">{subtitle}</p></div>{selected && <button onClick={() => setPlaying(!playing)} className="grid h-11 w-11 place-items-center rounded-full bg-white text-black">{playing ? 'Ⅱ' : '▶'}</button>}</div>
      </div>
    </main>
  );
}
