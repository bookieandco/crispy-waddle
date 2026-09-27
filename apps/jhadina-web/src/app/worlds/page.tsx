import Link from "next/link"
import { JHADINA_WORLDS, worldAssistantHref, worldDirectHref, type JhadinaWorldDefinition } from "@/lib/jhadina/jhadina-world-registry"

const groups: Array<{id:JhadinaWorldDefinition["group"];label:string}> = [
  { id:"core", label:"Core OS" },
  { id:"work", label:"Work" },
  { id:"intelligence", label:"Intelligence" },
  { id:"media", label:"Media & creation" },
  { id:"business", label:"Business & life" },
]

export default function WorldsPage(){
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Jhadina · Worlds</p>
  <h1 className="jh-title">One OS. Every subsystem.</h1>
  <p className="jh-copy">Every subsystem opens directly. Mature worlds enter their live workstation; worlds whose dedicated operator UI is still being built open a truthful direct hub with capabilities and an Ask Jhadina handoff instead of a dead link.</p>
  {groups.map(group=>{
   const worlds=JHADINA_WORLDS.filter(world=>world.group===group.id)
   return <section className="jh-section" key={group.id}><h2 className="jh-section-title">{group.label}</h2><div className="jh-grid">
    {worlds.map(world=><article className="jh-card jh-card--third" key={world.id}>
      <div className="jh-between"><div><h3 className="jh-card-title">{world.label}</h3><p className="jh-card-copy">{world.description}</p></div><span className={world.access==="native"?"jh-status jh-status--success":"jh-status"}><span className="jh-dot"/>{world.access==="native"?"Native":"Ask access"}</span></div>
      <div className="jh-row" style={{marginTop:16}}>
       <Link className="jh-button jh-button--primary" href={worldDirectHref(world)}>{world.href?"Open workstation":"Open world"}</Link>
       <Link className="jh-button" href={worldAssistantHref(world)}>Ask Jhadina</Link>
      </div>
    </article>)}
   </div></section>
  })}
 </div></main>
}
