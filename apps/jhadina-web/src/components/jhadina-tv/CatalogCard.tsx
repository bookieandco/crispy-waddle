'use client'

import type { CatalogItem } from '@/lib/jhadina-tv/unified-catalog'

interface Props {
  item: CatalogItem
  onWatch?: (item: CatalogItem) => void
  onSelect?: (item: CatalogItem) => void
}

export function CatalogCard({ item, onWatch, onSelect }: Props) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:bg-white/[0.07]">
      <button onClick={() => onSelect?.(item)} className="block w-full text-left">
        <div className="aspect-video bg-white/[0.06] p-4">
          <div className="flex h-full items-end">
            <div>
              {item.live && <span className="mb-2 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-black">Live</span>}
              <h3 className="line-clamp-2 text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-xs text-white/45">{item.genres.slice(0, 2).join(' · ') || item.type}</p>
            </div>
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between border-t border-white/10 px-3 py-2">
        <span className="truncate text-[11px] text-white/40">{item.includedSourceIds.length ? 'Included' : 'Available'}</span>
        <button onClick={() => onWatch?.(item)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90">Watch</button>
      </div>
    </article>
  )
}
