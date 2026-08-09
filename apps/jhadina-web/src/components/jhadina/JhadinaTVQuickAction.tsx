'use client'

import Link from 'next/link'

export function JhadinaTVQuickAction() {
  return (
    <Link
      href="/jhadina-tv/player"
      aria-label="Open JhadinaTV"
      className="group flex min-h-24 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/40"
    >
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl text-black shadow-lg">▶</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">JhadinaTV</span>
        <span className="mt-1 block text-xs leading-5 text-white/45">Live TV, sports, movies, shows and your connected services.</span>
      </span>
      <span aria-hidden="true" className="text-white/30 transition group-hover:translate-x-1 group-hover:text-white">→</span>
    </Link>
  )
}
