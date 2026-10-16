import Link from "next/link"
import { notFound } from "next/navigation"
import { getWorld,type JhadinaWorldId,worldAssistantHref } from "@/lib/jhadina/jhadina-world-registry"

export default function WorldDetailPage({params}:{params:{id:string}}){
 const world=getWorld(params.id as JhadinaWorldId)
 if(!world)notFound()
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Jhadina · World</p>
  <h1 className="jh-title">{world.label}</h1>
  <p className="jh-copy">{world.description}</p>
  <div className="jh-grid">
   <section className="jh-card jh-card--wide">
    <div className="jh-between"><div><p className="jh-eyebrow">Current surface</p><h2 className="jh-section-title">{world.access==="native"?"Native workstation":"Direct world hub"}</h2></div><span className={"jh-status"}><span className="jh-dot"/>{world.access==="native"?"UI route":"Assistant-backed"}</span></div>
    <p className="jh-card-copy">{world.access==="native"?"A dedicated UI route exists; provider commissioning, permissions and live health are verified separately.":"This world is part of Jhadina now, but its dedicated operator UI has not landed yet. This direct hub keeps it addressable without pretending a live workstation exists."}</p>
    <div className="jh-row" style={{marginTop:16}}>
     {world.href?<Link className="jh-button jh-button--primary" href={world.href}>Open workstation</Link>:null}
     <Link className="jh-button jh-button--primary" href={worldAssistantHref(world)}>Ask Jhadina in {world.label}</Link>
     <Link className="jh-button" href="/worlds">All worlds</Link>
    </div>
   </section>
   <section className="jh-card"><p className="jh-eyebrow">Capabilities</p><div className="jh-row">{world.capabilities.map(capability=><span className={capability.enabled?"jh-status jh-status--success":"jh-status"} key={capability.id} title={capability.reason}>{capability.label} · {capability.status}</span>)}</div></section>
   <section className="jh-card"><p className="jh-eyebrow">Intelligence inputs</p><p className="jh-card-copy">{world.intelligenceInputs.join(" · ")}</p></section>
  </div>
 </div></main>
}
