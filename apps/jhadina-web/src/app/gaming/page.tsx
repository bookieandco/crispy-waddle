import Link from "next/link"

export const metadata = {
  title: "Gaming | Jhadina",
  description: "Local-first gaming and Game Boy phone pilot",
}

export default function GamingPage(){
  return <main className="jh-page"><div className="jh-wrap">
    <p className="jh-eyebrow">Jhadina · Gaming Core</p>
    <h1 className="jh-title">Play your games. Keep your progress.</h1>
    <p className="jh-copy">A phone-first gaming hub for locally imported cartridges, backed-up saves, and future PC and console streaming. Local Game Boy gameplay needs reviewed self-hosted EmulatorJS assets before it can launch.</p>
    <div className="jh-grid">
      <section className="jh-card jh-card--wide" aria-labelledby="gb-title">
        <div className="jh-between"><div>
          <h2 className="jh-card-title" id="gb-title">Game Boy · Phone pilot</h2>
          <p className="jh-card-copy">Import your own .gb or .gbc cartridge. Library and save-state records stay in this browser using IndexedDB. Landscape mode is recommended.</p>
        </div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Runtime commissioning required</span></div>
        <div className="jh-row" style={{marginTop:16}}>
          <Link className="jh-button jh-button--primary" href="/gaming/gameboy/index.html">Open Game Boy lab</Link>
          <Link className="jh-button" href="/worlds">All Jhadina worlds</Link>
        </div>
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
