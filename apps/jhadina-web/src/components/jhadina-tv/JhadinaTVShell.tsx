'use client'

import { useState } from 'react'

const nav = ['Home', 'Live', 'Sports', 'Movies', 'Shows', 'Guide', 'My List']

export function JhadinaTVShell() {
  const [active, setActive] = useState('Home')

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4">
          <div className="shrink-0 text-lg font-semibold tracking-tight">Jhadina<span className="text-white/40">TV</span></div>
          <nav className="hidden gap-5 text-sm text-white/55 md:flex">
            {nav.map((item) => <button key={item} onClick={() => setActive(item)} className={`transition hover:text-white ${active === item ? 'text-white' : ''}`}>{item}</button>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/10" aria-label="Search">⌕ <span className="hidden sm:inline">Search</span></button>
            <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">Connect TV</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-10 lg:min-h-[520px] lg:p-16">
          <div className="max-w-2xl lg:pt-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-white/40">{active}</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Your entertainment. One place.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/55 sm:text-lg">JhadinaTV brings your live channels, sports, movies, shows, and connected services together.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">▶ Watch</button>
              <button className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium hover:bg-white/10">＋ My List</button>
            </div>
          </div>
        </section>

        {['Continue Watching', 'Live Now', 'Sports', 'Because You Like This', 'Your Services'].map((section) => (
          <section key={section} className="mt-10">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold sm:text-xl">{section}</h2><button className="text-sm text-white/40 hover:text-white">See all</button></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((item) => <div key={item} className="aspect-video rounded-2xl border border-white/10 bg-white/[0.04]" />)}
            </div>
          </section>
        ))}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/90 px-2 py-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg justify-around text-[11px] text-white/50">
          {['Home', 'Live', 'Sports', 'Search', 'My List'].map((item) => <button key={item} onClick={() => setActive(item)} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 ${active === item ? 'bg-white/10 text-white' : ''}`}><span className="text-base">{item === 'Search' ? '⌕' : item === 'My List' ? '＋' : '●'}</span>{item}</button>)}
        </div>
      </nav>
    </div>
  )
}
