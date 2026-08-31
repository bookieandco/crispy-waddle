import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createMediaProviderRegistry, JHADINA_TV_ROUTES } from '@jhadina/tv-core'

interface Props {
  params: Promise<{ provider: string; kind: string; id: string }>
}

export const dynamic = 'force-dynamic'

export default async function MediaDetailPage({ params }: Props) {
  const { provider, kind, id } = await params
  const registry = createMediaProviderRegistry({ youtubeApiKey: process.env.YOUTUBE_API_KEY })
  const mediaProvider = registry.get(provider)
  if (!mediaProvider) notFound()

  const item = await mediaProvider.get(id)
  if (!item || item.kind !== kind) notFound()

  const canPlay = item.capabilities.includes('play')
  const availability = item.metadata?.availability ?? 'external'

  return (
    <main style={{ minHeight: '100vh', background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 64px' }}>
        <Link href="/jhadinatv" style={{ color: '#aeb2bd', textDecoration: 'none' }}>← Media Home</Link>
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 420px) 1fr', gap: 36, marginTop: 28 }}>
          <div style={{ overflow: 'hidden', borderRadius: 20, background: '#111319', border: '1px solid #23262f' }}>
            {item.artworkUrl ? <img src={item.artworkUrl} alt="" style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }} /> : <div style={{ aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', color: '#727683' }}>No artwork</div>}
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#aeb2bd', fontSize: 13 }}>
              <span>{mediaProvider.name}</span><span>•</span><span>{kind}</span><span>•</span><span>{availability}</span>
            </div>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.02, margin: '12px 0' }}>{item.title}</h1>
            {item.subtitle && <p style={{ color: '#b7bac4', fontSize: 18 }}>{item.subtitle}</p>}
            {item.description && <p style={{ color: '#9b9eaa', lineHeight: 1.7, maxWidth: 720 }}>{item.description}</p>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
              {item.capabilities.map((capability) => <span key={capability} style={{ padding: '7px 10px', borderRadius: 999, background: '#151821', color: '#aeb2bd', fontSize: 12 }}>{capability}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
              {canPlay && <Link href={JHADINA_TV_ROUTES.watch(kind === 'video' ? 'tv' : 'movie', id)} style={{ padding: '12px 18px', borderRadius: 999, background: '#f7f7f8', color: '#08090c', textDecoration: 'none', fontWeight: 700 }}>Play / Resume</Link>}
              <button type="button" style={{ padding: '12px 18px', borderRadius: 999, border: '1px solid #2a2c33', background: '#111319', color: '#f7f7f8' }}>Add to Queue</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
