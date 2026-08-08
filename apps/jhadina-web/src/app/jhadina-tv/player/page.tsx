import { JhadinaTVPlayer } from '@/components/jhadina-tv/JhadinaTVPlayer'

export default function JhadinaTVPlayerPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-white/50">JhadinaTV Player</p>
        <h1 className="mb-6 text-3xl font-semibold">Watch</h1>
        <JhadinaTVPlayer
          title="JhadinaTV demo player"
          tracks={[
            { id: 'en', label: 'English captions', language: 'en' },
            { id: 'es', label: 'Spanish', language: 'es' },
          ]}
        />
        <p className="mt-4 text-sm text-white/40">Select authorized media from JhadinaTV to populate the player source.</p>
      </div>
    </main>
  )
}
