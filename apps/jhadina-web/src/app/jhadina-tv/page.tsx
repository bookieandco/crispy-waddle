import Link from 'next/link'
import { JHADINA_TV_NAV, JHADINA_TV_ROUTES } from '@/lib/jhadina-tv/ui-contract'
import { buildDevicePickerModel } from '@/lib/jhadina-tv/device-picker-model'

const devices = buildDevicePickerModel()

export default function JhadinaTVPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-8">
          <Link href={JHADINA_TV_ROUTES.home} className="text-xl font-bold tracking-tight">JhadinaTV</Link>
          <nav className="flex gap-5 overflow-x-auto text-sm text-white/70">
            {JHADINA_TV_NAV.map((item) => (
              <Link key={item.id} href={JHADINA_TV_ROUTES[item.id]} className="whitespace-nowrap hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <button className="ml-auto rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Connect TV</button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-10 pt-16">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-white/50">Your media command center</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">What do you want to watch?</h1>
          <p className="mt-5 max-w-2xl text-white/60">JhadinaTV brings live channels, movies, shows, and your connected screens into one place.</p>
        </div>

        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Connect a screen</h2><span className="text-xs text-white/40">Device control and playback transports</span></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {devices.map(({ device, label, status, transportLabel }) => (
              <button key={device.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-white/25 hover:bg-white/[0.07]">
                <div className="flex items-center justify-between"><span className="font-medium">{label}</span><span className="text-xs text-white/50">{status}</span></div>
                <p className="mt-2 text-sm text-white/50">{transportLabel}</p>
              </button>
            ))}
          </div>
        </section>

        {['Continue Watching', 'Live Now', 'Jhadina Recommends'].map((section) => (
          <section key={section} className="mt-12">
            <h2 className="mb-4 text-xl font-semibold">{section}</h2>
            <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-sm text-white/35">
              Content sources will populate this section.
            </div>
          </section>
        ))}
      </section>
    </main>
  )
}
