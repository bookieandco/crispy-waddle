"use client"

import Link from "next/link"
import {getNoHostOperatingPlan} from "./no-host-operating-plan"

export function NoHostModeCard({hostOnAuditHold}:{hostOnAuditHold:boolean}){
 const plan=getNoHostOperatingPlan()
 return <section className="jh-card jh-card--wide" aria-label="No-model operating mode"
  style={{marginTop:12}}>
  <p className="jh-eyebrow">NO VERIFIED MODEL HOST · READ-ONLY CONTINUITY</p>
  <h2 className="jh-card-title">{hostOnAuditHold?"MacBook audit and repair pending":"Independent host not yet commissioned"}</h2>
  <p className="jh-card-copy">Jhadina&apos;s general local AI reasoning is not available right now. She will not secretly switch to a paid model or pretend the legacy classifier generated an answer. Existing workspaces, saved-session tools, and owner-initiated public source lookup remain accessible.</p>
  <div className="jh-row" style={{marginTop:12}}>
   {plan.workspaces.map(world=><Link key={world.id} className="jh-button" href={world.href}>{world.label}</Link>)}
   <Link className="jh-button" href="/worlds">All workspaces</Link>
  </div>
  <p className="jh-meta" style={{marginTop:12}}>{plan.disclaimer} Public Wikipedia lookup below is manual and source-attributed; no private conversation is sent unless a user chooses a public search phrase.</p>
  {hostOnAuditHold?<p className="jh-meta">MacBook tracking: <a href="https://github.com/bookieandco/crispy-waddle/issues/1486" target="_blank" rel="noopener noreferrer">audit/repair issue #1486</a>. Actual hardware condition is unverified.</p>:null}
 </section>
}
