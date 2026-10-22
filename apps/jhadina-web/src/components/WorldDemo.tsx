"use client"

import { useState } from "react"
import type { WorldCapability } from "@/lib/jhadina/jhadina-world-registry"

/** Local preview only: no provider requests or execution authority. */
export function WorldDemo({ label, capabilities }: { label: string; capabilities: WorldCapability[] }) {
 const [selected, setSelected] = useState(capabilities[0]?.id ?? "")
 return <section className="jh-card jh-card--wide" aria-label={`${label} demo`}>
  <span className="jh-status jh-status--warning">Demo · sample only</span>
  <h2 className="jh-section-title" style={{marginTop:16}}>Explore {label}</h2>
  <p className="jh-card-copy">Preview the planned workspace. These sample steps stay on this page; connected data will appear when this workspace is ready.</p>
  <div className="jh-row" style={{marginTop:16}} aria-label="Preview a capability">
   {capabilities.map(item=><button type="button" className={selected===item.id?"jh-button jh-button--primary":"jh-button"} aria-pressed={selected===item.id} key={item.id} onClick={()=>setSelected(item.id)}>{item.label}</button>)}
  </div>
  <div className="jh-list" aria-live="polite">
   <article className="jh-item"><strong>{selected || "Workspace"} · Sample brief</strong><p className="jh-card-copy">Choose your goal and gather the relevant material for {label}.</p></article>
   <article className="jh-item"><strong>Review</strong><p className="jh-card-copy">Compare the evidence and prepare a draft with Jhadina before taking action.</p></article>
   <article className="jh-item"><strong>Next step</strong><p className="jh-card-copy">Use the Ask Jhadina button below to discuss this world. No live action runs from this demo.</p></article>
  </div>
 </section>
}
