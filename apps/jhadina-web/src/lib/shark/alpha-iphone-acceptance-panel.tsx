"use client"
import {useState} from "react"
import {ALPHA_IPHONE_CHECKS,createAlphaLocalAcceptance,type AlphaIphoneCheckId} from "./alpha-iphone-acceptance"

/** Browser session checklist, deliberately no network, storage, or fake acceptance. */
export function AlphaIphoneAcceptancePanel(){
 const [selected,setSelected]=useState<readonly AlphaIphoneCheckId[]>([])
 const receipt=createAlphaLocalAcceptance({
  recordedAt:"2026-10-17T00:00:00Z", // display-only ephemeral placeholder; never persisted or certified
  selected,
 })
 const toggle=(name:AlphaIphoneCheckId,checked:boolean)=>{
  setSelected(previous=>checked?[...previous.filter(x=>x!==name),name]:previous.filter(x=>x!==name))
 }
 return <section className="jh-card" aria-label="Owner iPhone acceptance checks"
   style={{marginTop:18,display:"grid",gap:12}}>
  <h2 style={{fontSize:18,margin:0}}>iPhone readiness checklist</h2>
  <p className="jh-copy" style={{margin:0}}>
   Use these checks on your actual iPhone in Safari. This browser-only checklist
   does not connect provider accounts, certify a host or store device results.
  </p>
  <div style={{display:"grid",gap:12}}>
   {ALPHA_IPHONE_CHECKS.map(check=><label key={check.id}
     style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",lineHeight:1.45}}>
     <input type="checkbox" style={{width:18,height:18,marginTop:2,flexShrink:0}}
       checked={receipt.checks[check.id]}
       onChange={event=>toggle(check.id,event.target.checked)}/>
     <span>{check.label}</span>
   </label>)}
  </div>
  <p role="status" className="jh-copy" style={{margin:0}}>
   {receipt.passed}/{receipt.total} locally checked. Not independently certified.
  </p>
  <p className="jh-copy" style={{margin:0}}>
   Production deployment, actual social reads, owner-private alerts and
   restored database remain separate external acceptance requirements.
  </p>
 </section>
}
