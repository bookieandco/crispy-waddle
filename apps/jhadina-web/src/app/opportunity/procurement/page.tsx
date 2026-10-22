"use client"

import Link from "next/link"
import {useEffect,useState} from "react"

type Provider={id:string;name:string;capabilityClaim:string;sourceUrl:string;qualification:string;quote:string;partnerConsent:string;requiredChecks:string[]}
type Case={id:string;buyer:string;title:string;kind:string;officialSourceUrl:string;buyerContactSourceUrl:string;buyerPhone?:string;buyerEmail?:string;deadlineAt?:string;deadlineStatus:string;description:string;candidates:Provider[];blockers:string[];nextActions:string[];scopeComplete:false;requiredFormsVerified:false;addendaComplete:false}
type Pilot={snapshotAt:string;status:string;opportunities:Case[];outreachAuthorized:false;bidSubmissionAuthorized:false;signatureAuthorized:false;paymentAuthorized:false}
type Source={sourceId:string;sourceUrl:string;action:string;priority:number;blockers:string[];reasons:string[];externalFetchAuthorized:false}
type PilotResponse={ok:boolean;docket?:Pilot;error?:string}
type SourceResponse={ok:boolean;decisions?:Source[];scanned?:number;sourceSnapshotIsPartial?:boolean;error?:string}
type Draft={ok:boolean;buyerContacts?:Array<{name?:string;email?:string;phone?:string;sourceUrl:string}>;packet?:{status:string;blockers:string[]};error?:string;observed?:{title:string}}
const shell:React.CSSProperties={minHeight:"100vh",background:"#0d131c",color:"#eff3f1",fontFamily:"system-ui,-apple-system,sans-serif",padding:"24px 14px 90px"}
const contentWidth:React.CSSProperties={maxWidth:990,margin:"auto"}
const section:React.CSSProperties={background:"#151f2b",border:"1px solid #334052",borderRadius:18,padding:20,marginTop:16}
const mini:React.CSSProperties={fontSize:12,letterSpacing:1.1,color:"#9eb7a8",fontWeight:700,textTransform:"uppercase"}
const dim:React.CSSProperties={fontSize:14,color:"#b3bfca",lineHeight:1.65}
const link:React.CSSProperties={color:"#92d7b0",textDecoration:"underline",overflowWrap:"anywhere"}
const pill:React.CSSProperties={border:"1px solid #6a5732",color:"#e4ca8c",padding:"4px 9px",borderRadius:20,fontSize:12,display:"inline-block",fontWeight:600}
const btn:React.CSSProperties={background:"#d0e4d8",color:"#13231c",fontWeight:700,border:0,padding:"12px 18px",borderRadius:10,cursor:"pointer"}
const boxTitle:React.CSSProperties={fontSize:19,fontWeight:750,margin:"8px 0 4px"}
function SourceLink({href,children}:{href:string;children:React.ReactNode}){return <a href={href} target="_blank" rel="noopener noreferrer" style={link}>{children} ↗</a>}
function Deadline({value,continuous}:{value?:string;continuous:boolean}){
 if(continuous)return <span style={pill}>Continuous qualification · not a contract award</span>
 if(!value)return <span style={pill}>Deadline requires official confirmation</span>
 const expired=Date.parse(value)<Date.now()
 return <span style={pill}>{expired?"Past listed deadline · reverify":"Listed deadline"}: {new Date(value).toLocaleString("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"})}</span>
}
export default function GovernmentProcurementWorkspace(){
 const [pilot,setPilot]=useState<Pilot|null>(null)
 const [sources,setSources]=useState<Source[]>([])
 const [snapshot,setSnapshot]=useState<number|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [samId,setSamId]=useState("")
 const [samDraft,setSamDraft]=useState<Draft|null>(null)
 const [reviewing,setReviewing]=useState(false)
 async function load(){
  setLoading(true);setError("")
  try{
   const [pilotResponse,sourceResponse]=await Promise.all([
    fetch("/api/opportunities/procurement?mode=pilot",{cache:"no-store"}),
    fetch("/api/opportunities/procurement?state=CA&limit=35",{cache:"no-store"})
   ])
   const a=await pilotResponse.json() as PilotResponse
   const b=await sourceResponse.json() as SourceResponse
   if(!pilotResponse.ok||!a.ok)throw new Error(a.error??"Could not load research pilot")
   setPilot(a.docket??null)
   if(sourceResponse.ok&&b.ok){setSources(b.decisions??[]);setSnapshot(b.scanned??0)}
   else{setSources([]);setSnapshot(null);setError("Source recovery registry unavailable. Pilot remains read-only.")}
  }catch(e){setError(e instanceof Error?e.message:"Procurement unavailable")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 async function reviewSam(){
  if(!/^[a-f0-9]{32}$/i.test(samId.trim())){setError("Enter a 32-character SAM notice ID from the federal contracts workspace.");return}
  setReviewing(true);setError("");setSamDraft(null)
  try{
   const res=await fetch("/api/opportunities/procurement",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({samNoticeId:samId.trim()}),cache:"no-store"})
   const json=await res.json() as Draft
   if(!res.ok||!json.ok)throw new Error(json.error??"SAM notice unavailable")
   setSamDraft(json)
  }catch(e){setError(e instanceof Error?e.message:"Could not review SAM notice")}
  finally{setReviewing(false)}
 }
 return <main style={shell}><div style={contentWidth}>
  <nav style={{display:"flex",gap:18,flexWrap:"wrap",fontSize:14,marginBottom:20}}><Link href="/opportunity" style={link}>← Opportunities</Link><Link href="/opportunity/sam" style={link}>Federal contracts</Link><Link href="/opportunity/subnet" style={link}>Prime subcontracting</Link></nav>
  <div style={mini}>Jhadina · Opportunity Core</div>
  <h1 style={{fontSize:"clamp(28px,5vw,42px)",margin:"8px 0"}}>Government &amp; School Procurement</h1>
  <p style={{...dim,maxWidth:720}}>Official buyer listings, potential fulfillment companies and no-send bid reviews. Research matches are <strong style={{color:"#fff"}}>not verified partners</strong>. Every contact, quote request, submission and spend still needs separate approval.</p>
  <div style={{...section,background:"#20291f",borderColor:"#465741"}}>
   <div style={mini}>Operator authorization</div>
   <p style={{marginBottom:0,lineHeight:1.5}}>No outbound communication · No quote request · No bid submission · No signature · No spending. This screen is evidence review only.</p>
  </div>
  {error&&<div role="alert" style={{...section,borderColor:"#bd7652",color:"#ffd1c0"}}>{error}</div>}
  {loading?<p style={dim}>Loading procurement source and pilot evidence…</p>:<div>
   <section style={section}>
    <h2 style={boxTitle}>First pursuit pilots</h2>
    <p style={dim}>Research snapshots; the official bidding documents, addenda and legal eligibility must be checked before a quote or proposal.</p>
    {pilot?.opportunities.map(c=><article key={c.id} style={{padding:"20px 0",borderTop:"1px solid #334052"}}>
     <div style={{...mini,marginBottom:6}}>{c.id} · {c.buyer}</div>
     <h3 style={{fontSize:21,margin:"0 0 10px"}}>{c.title}</h3>
     <Deadline value={c.deadlineAt} continuous={c.kind==="continuous_rfsq"}/>
     <p style={dim}>{c.description}</p>
     <div style={{display:"flex",gap:12,flexWrap:"wrap",margin:"12px 0"}}><SourceLink href={c.officialSourceUrl}>Official buyer listing</SourceLink><SourceLink href={c.buyerContactSourceUrl}>Official purchasing contact</SourceLink></div>
     {(c.buyerPhone||c.buyerEmail)&&<p style={dim}>Buyer: {c.buyerPhone??""}{c.buyerEmail?" · "+c.buyerEmail:""}</p>}
     <h4 style={{marginBottom:6}}>Candidate fulfillment companies ({c.candidates.length})</h4>
     {c.candidates.length===0?<p style={dim}>No eligible vendor has been qualified for the chosen RFSQ service category.</p>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))",gap:10}}>
      {c.candidates.map(v=><div key={v.id} style={{border:"1px solid #3a4a5a",borderRadius:12,padding:12,background:"#1a2532"}}>
       <strong>{v.name}</strong><p style={{...dim,fontSize:12,margin:"5px 0"}}>{v.capabilityClaim}</p>
       <div style={{...pill,fontSize:11}}>Candidate only · No quote</div>
       <p style={{marginBottom:0}}><SourceLink href={v.sourceUrl}>Company capability evidence</SourceLink></p>
      </div>)}
      </div>}
     <details style={{marginTop:16}} open={c.id==="RUSD-2026-27-11"}>
      <summary style={{cursor:"pointer",fontWeight:750}}>Missing evidence / blockers ({c.blockers.length})</summary>
      <ul style={dim}>{c.blockers.map(x=><li key={x}>{x}</li>)}</ul>
     </details>
     <details><summary style={{cursor:"pointer",fontWeight:750,marginTop:10}}>Next controlled actions ({c.nextActions.length})</summary>
      <ol style={dim}>{c.nextActions.map(x=><li key={x}>{x}</li>)}</ol>
     </details>
    </article>)}
   </section>
   <section style={section}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:15,flexWrap:"wrap"}}>
     <h2 style={boxTitle}>California source recovery</h2>
     <button type="button" onClick={()=>void load()} style={btn}>Refresh</button>
    </div>
    <p style={dim}>Priority samples from the existing official-source registry; not every archived page is a real procurement feed. Unverified site access, stale document pages and irrelevant sources are held for manual review.</p>
    <p style={{...mini,margin:"5px 0"}}>Rows scanned: {snapshot===null?"Unavailable":snapshot} · displayed: {sources.length} · sample only</p>
    {sources.length===0?<p style={dim}>No source queue is available in this session.</p>:
    <div style={{display:"grid",gap:10}}>
    {sources.slice(0,30).map(s=><div key={s.sourceId} style={{borderTop:"1px solid #334052",paddingTop:12}}>
     <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><strong>{s.action.replace(/_/g," ")}</strong><span style={mini}>Priority {s.priority}</span></div>
     <div style={{fontSize:12,color:"#a9c4b8",overflowWrap:"anywhere",margin:"5px 0"}}>{s.sourceId}</div>
     <SourceLink href={s.sourceUrl}>{s.sourceUrl}</SourceLink>
     {s.blockers.length>0&&<p style={{...dim,fontSize:12,color:"#f3bba0"}}>{s.blockers.join(" · ")}</p>}
    </div>)}
    </div>}
   </section>
   <section style={section}>
    <h2 style={boxTitle}>SAM.gov contracting contact review</h2>
    <p style={dim}>Enter a notice ID already present in Jhadina’s federal catalog. Extracts contact evidence from captured documents and returns a blocked review packet until requirements, forms, quotes and approvals are verified.</p>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
     <input aria-label="SAM notice ID" placeholder="32-character SAM notice ID" value={samId} onChange={e=>setSamId(e.target.value)} style={{flex:"1 1 240px",minWidth:180,borderRadius:10,padding:12,border:"1px solid #526273",background:"#111925",color:"#fff"}}/>
     <button disabled={reviewing} type="button" onClick={()=>void reviewSam()} style={{...btn,opacity:reviewing?0.6:1}}>{reviewing?"Reviewing…":"Read captured contact"}</button>
    </div>
    {samDraft&&<div style={{marginTop:14}}>
     <strong>{samDraft.observed?.title??"SAM notice"}</strong>
     <p style={dim}>Packet state: {samDraft.packet?.status??"Unavailable"}</p>
     {samDraft.buyerContacts?.map((c,i)=><div key={i} style={{...dim,padding:"6px 0"}}>
      {c.name??"Official source contact"} {c.email??""} {c.phone??""}
      <div><SourceLink href={c.sourceUrl}>Captured official source</SourceLink></div>
     </div>)}
     <ul style={dim}>{(samDraft.packet?.blockers??[]).slice(0,12).map(x=><li key={x}>{x}</li>)}</ul>
    </div>}
   </section>
  </div>}
 </div></main>
}
