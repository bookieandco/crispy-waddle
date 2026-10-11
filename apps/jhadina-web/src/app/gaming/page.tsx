import Link from "next/link"

export const metadata = {
  title: "Gaming | Jhadina",
  description: "Local-first gaming and Game Boy phone pilot",
}

export default function GamingPage(){
  return <main className="jh-page"><div className="jh-wrap">
    <p className="jh-eyebrow">Jhadina · Gaming Core</p>
    <h1 className="jh-title">Play your games. Keep your progress.</h1>
    <p className="jh-copy">A phone-first gaming hub for locally imported cartridges, backed-up saves, and future PC and console streaming. The self-hosted Game Boy WASM core is included in the preview; additional console systems are evaluated separately.</p>
    <div className="jh-grid">
      <section className="jh-card jh-card--wide" aria-labelledby="arcade-title">
        <h2 className="jh-card-title" id="arcade-title">Neon Run · Original Jhadina arcade</h2>
        <p className="jh-card-copy">Play right now on your phone or laptop. Dodge meteors, collect stars, and beat your best score. No emulator, ROM, subscription, or Homebase is required.</p>
        <div className="jh-row" style={{marginTop:16}}>
          <Link className="jh-button jh-button--primary" href="/gaming/neon-run/index.html">Play Neon Run</Link>
        </div>
      </section>

      <section className="jh-card jh-card--wide" aria-labelledby="gb-title">
        <div className="jh-between"><div>
          <h2 className="jh-card-title" id="gb-title">Game Boy · Phone pilot</h2>
          <p className="jh-card-copy">Play the free 2048 homebrew or import your own .gb/.gbc cartridge. The MIT Game Boy WebAssembly core is bundled, with touch and save-state support.</p>
        </div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Physical iPhone acceptance pending</span></div>
        <div className="jh-row" style={{marginTop:16}}>
          <Link className="jh-button jh-button--primary" href="/gaming/gameboy/index.html">Open Game Boy lab</Link>
          <Link className="jh-button" href="/worlds">All Jhadina worlds</Link>
        </div>
      </section>
      <section className="jh-card" aria-labelledby="device-test-title">
        <h2 className="jh-card-title" id="device-test-title">Phone and controller self-test</h2>
        <p className="jh-card-copy">Test touch input, supported gamepads, local save storage, WebCrypto and landscape orientation on your own device. Download a privacy-safe evidence receipt to keep in Google Drive.</p>
        <div className="jh-row" style={{marginTop:12}}>
          <Link className="jh-button" href="/gaming/diagnostics/index.html">Run phone diagnostics</Link>
        </div>
      </section>
      <section className="jh-card" aria-labelledby="native-handheld-title">
        <h2 className="jh-card-title" id="native-handheld-title">Classic handheld emulators · Host candidates</h2>
        <p className="jh-card-copy"><strong>PatBoy</strong> supports classic Game Boy on a reviewed Windows host. <strong>Hades</strong> targets Game Boy Advance on supported desktop hosts. Neither is installed or available for direct iPhone play yet.</p>
        <div className="jh-row" style={{marginTop:12}}>
          <a className="jh-button" href="https://github.com/Jonazan2/PatBoy" target="_blank" rel="noopener noreferrer">PatBoy source</a>
          <a className="jh-button" href="https://github.com/hades-emu/Hades" target="_blank" rel="noopener noreferrer">Hades source</a>
        </div>
        <span className="jh-status jh-status--warning"><span className="jh-dot"/>Installation / native host AUDIT-REPAIR</span>
      </section>
      <section className="jh-card jh-card--wide" aria-labelledby="multi-console-title">
        <h2 className="jh-card-title" id="multi-console-title">Additional emulators · reviewed candidates</h2>
        <p className="jh-card-copy">Jgenesis covers Sega, SNES and more, with separate desktop and WebAssembly targets. RetroArch is a frontend for separately licensed cores. DuckStation is a desktop PS1 option that needs owner-provided BIOS. Snes9x provides SNES emulation. KytyPS5 remains experimental desktop research, not phone play.</p>
        <p className="jh-card-copy">DuckStation and Snes9x have commercial-use restrictions. None of these additional emulators, system firmware, or game images is installed automatically.</p>
        <div className="jh-row" style={{marginTop:12}}>
          <a className="jh-button" href="https://github.com/jsgroth/jgenesis" target="_blank" rel="noopener noreferrer">Jgenesis</a>
          <a className="jh-button" href="https://www.retroarch.com" target="_blank" rel="noopener noreferrer">RetroArch</a>
          <a className="jh-button" href="https://github.com/stenzek/duckstation/releases/tag/latest" target="_blank" rel="noopener noreferrer">DuckStation</a>
          <a className="jh-button" href="https://github.com/snes9xgit/snes9x" target="_blank" rel="noopener noreferrer">Snes9x</a>
          <a className="jh-button" href="https://kytyps5.github.io" target="_blank" rel="noopener noreferrer">KytyPS5</a>
        </div>
        <span className="jh-status jh-status--warning"><span className="jh-dot"/>Source, license, host and compatibility approval pending</span>
      </section>
      <section className="jh-card" aria-labelledby="streaming-title">
        <h2 className="jh-card-title" id="streaming-title">PC and console streaming</h2>
        <p className="jh-card-copy">Sunshine/Moonlight, PlayStation Remote Play and supported Xbox routes are designed in Game Core, but none is certified on physical hardware yet.</p>
        <span className="jh-status jh-status--warning"><span className="jh-dot"/>Hardware AUDIT/REPAIR</span>
      </section>
      <section className="jh-card" aria-labelledby="storage-title">
        <h2 className="jh-card-title" id="storage-title">Storage and backups</h2>
        <p className="jh-card-copy">Local database storage works without Supabase. Device storage can be evicted; manually export a verified save backup from the Game Boy lab before clearing browser data.</p>
        <span className="jh-status"><span className="jh-dot"/>Local-only</span>
      </section>
    </div>
  </div></main>
}
