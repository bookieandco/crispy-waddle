"use client"

import Link from "next/link"
import {useEffect,useState,type ReactNode,type CSSProperties} from "react"

type Provider={id:string;name:string;capabilityClaim:string;sourceUrl:string;qualification:string;quote:string;partnerConsent:string;requiredChecks:string[]}
type Case={id:string;buyer:string;title:string;kind:string;officialSourceUrl:string;buyerContactSourceUrl:string;buyerPhone?:string;buyerEmail?:string;deadlineAt?:string;deadlineStatus:string;description:string;candidates:Provider[];blockers:string[];nextActions:string[];scopeComplete:false;requiredFormsVerified:false;addendaComplete:false}
type Pilot={snapshotAt:string;status:string;opportunities:Case[];outreachAuthorized:false;bidSubmissionAuthorized:false;signatureAuthorized:false;paymentAuthorized:false}
type Source={sourceId:string;sourceUrl:string;action:string;priority:number;blockers:string[];reasons:string[];externalFetchAuthorized:false}
type NationalState={state:string;jurisdictions:number;sourceBearing:number;verifiedSourceJurisdictions:number;certifiedReadOnlyJurisdictions:number;totalSourceRecords:number;blockedJobs:number;noProviderJobs:number;recoveryReadyJobs:number}
type NationalReport={registryJurisdictions:number;representedStates:number;sourceBearingJurisdictions:number;officiallyVerifiedJurisdictions:number;certifiedReadOnlyJurisdictions:number;blockedDiscoveryJobs:number;noProviderJobs:number;sources:number;states:NationalState[]}
type NationalResponse={ok:boolean;report?:NationalReport;error?:string}
type PilotResponse={ok:boolean;docket?:Pilot;error?:string}
type SourceResponse={ok:boolean;decisions?:Source[];scanned?:number;sourceSnapshotIsPartial?:boolean;error?:string}
type Draft={ok:boolean;buyerContacts?:Array<{name?:string;email?:string;phone?:string;sourceUrl:string}>;packet?:{status:string;blockers:string[]};error?:string;observed?:{title:string}}
const shell:CSSProperties={minHeight:"100vh",background:"#0d131c",color:"#eff3f1",fontFamily:"system-ui,-apple-system,sans-serif",padding:"24px 14px 90px"}
const contentWidth:CSSProperties={maxWidth:990,margin:"auto"}
const section:CSSProperties={background:"#151f2b",border:"1px solid #334052",borderRadius:18,padding:20,marginTop:16}
const mini:CSSProperties={fontSize:12,letterSpacing:1.1,color:"#9eb7a8",fontWeight:700,textTransform:"uppercase"}
const dim:CSSProperties={fontSize:14,color:"#b3bfca",lineHeight:1.65}
const link:CSSProperties={color:"#92d7b0",textDecoration:"underline",overflowWrap:"anywhere"}
const pill:CSSProperties={border:"1px solid #6a5732",color:"#e4ca8c",padding:"4px 9px",borderRadius:20,fontSize:12,display:"inline-block",fontWeight:600}
const btn:CSSProperties={background:"#d0e4d8",color:"#13231c",fontWeight:700,border:0,padding:"12px 18px",borderRadius:10,cursor:"pointer"}
const boxTitle:CSSProperties={fontSize:19,fontWeight:750,margin:"8px 0 4px"}
function SourceLink({href,children}:{href:string;children:ReactNode}){return <a href={href} target="_blank" rel="noopener noreferrer" style={link}>{children} ↗</a>}
function Deadline({value,continuous}:{value?:string;continuous:boolean}){
 if(continuous)return <span style={pill}>Continuous qualification · not a contract award</span>
 if(!value)return <span style={pill}>Deadline requires official confirmation</span>
 const expired=Date.parse(value)<Date.now()
 return <span style={pill}>{expired?"Past listed deadline · reverify":"Listed deadline"}: {new Date(value).toLocaleString("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"})}</span>
}
type DirectoryRow={
 id:string;name:string;state:string;level:string;sourceCount:number;verifiedSourceCount:number
 certifiedSourceCount:number;inventorySourceUrl:string;discoveryStatus:string
 inboxObservations:Array<{id:string;title:string;sourceUrl:string;lastSeenAt:string}>
 examples:Array<{name:string;url:string;status:string;certified:boolean}>;sourceDataMayBePartial:boolean;bidReady:false
}
type DirectoryResponse={ok:boolean;total:number;results:DirectoryRow[];sourceSamplePartial:boolean;error?:string}
const jurisdictionLevels=[
 ['','All types'],['state','State'],['county','Counties'],['city','Cities'],
 ['school_district','School districts'],['special_district','Special districts'],
 ['public_university','Public universities'],['public_hospital','Public hospitals'],
 ['authority','Authorities'],
]
function JurisdictionDirectory({state}:{state:string}){
 const [level,setLevel]=useState("")
 const [typed,setTyped]=useState("")
 const [search,setSearch]=useState("")
 const [offset,setOffset]=useState(0)
 const [result,setResult]=useState<DirectoryResponse|null>(null)
 const [error,setError]=useState("")
 const [loading,setLoading]=useState(false)
 const [reviewing,setReviewing]=useState<string|null>(null)
 const [reviews,setReviews]=useState<Record<string,{status?:string;blockers:string[]}>>({})
 useEffect(()=>{setOffset(0)},[state,level,search])
 useEffect(()=>{
  let alive=true
  async function load(){
   setLoading(true);setError("")
   try{
    const params=new URLSearchParams({state,limit:"20",offset:String(offset)})
    if(level)params.set("level",level)
    if(search)params.set("search",search)
    const response=await fetch("/api/opportunities/procurement/jurisdictions?"+params.toString(),{cache:"no-store"})
    const value=await response.json() as DirectoryResponse
    if(!response.ok||!value.ok)throw Error(value.error??"Jurisdiction search unavailable")
    if(alive)setResult(value)
   }catch(e){if(alive){setResult(null);setError(e instanceof Error?e.message:"Unable to load jurisdictions")}}
   finally{if(alive)setLoading(false)}
  }
  void load()
  return ()=>{alive=false}
 },[state,level,search,offset])
 async function reviewInbox(id:string){
  setReviewing(id);setError("")
  try{
   const response=await fetch("/api/opportunities/procurement",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({inboxId:id}),cache:"no-store"
   })
   const payload=await response.json() as {ok:boolean;packet?:{status?:string;blockers?:string[]};error?:string}
   if(!response.ok||!payload.ok)throw Error(payload.error??"No-send review unavailable")
   setReviews(previous=>({...previous,[id]:{
    status:payload.packet?.status,blockers:payload.packet?.blockers??[]
   }}))
  }catch(e){setError(e instanceof Error?e.message:"No-send review failed")}
  finally{setReviewing(null)}
 }
 return <section style={section}>
  <div style={mini}>Nationwide buyer directory</div>
  <h2 style={boxTitle}>Search {state} governments and public entities</h2>
  <p style={dim}>Browse actual jurisdiction IDs, verified procurement sources and certification status. A found source is not a bid invitation and never authorizes outreach.</p>
  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
   <select aria-label="Jurisdiction type" value={level} onChange={e=>{setLevel(e.target.value);setOffset(0)}} style={{borderRadius:8,padding:11,background:"#121a25",color:"#fff",border:"1px solid #526273"}}>
    {jurisdictionLevels.map(([id,label])=><option key={id} value={id}>{label}</option>)}
   </select>
   <form onSubmit={e=>{e.preventDefault();setOffset(0);setSearch(typed.trim())}} style={{display:"flex",flex:"1 1 210px",gap:8}}>
    <input aria-label="Jurisdiction name" value={typed} maxLength={80} placeholder="County, city, district or school" onChange={e=>setTyped(e.target.value)} style={{flex:"1 1 145px",minWidth:90,background:"#111925",color:"#fff",padding:11,borderRadius:8,border:"1px solid #526273"}}/>
    <button type="submit" style={btn}>Find</button>
   </form>
  </div>
  {loading&&<p style={dim}>Reading registered public buyers…</p>}
  {error&&<p role="alert" style={{color:"#ffd1c0"}}>{error}</p>}
  {result&&!loading&&<div>
   <p style={{...dim,fontSize:12}}>Matched {result.total.toLocaleString()} jurisdictions · showing {result.results.length} at offset {offset}{result.sourceSamplePartial?" · source counts sampled":""}</p>
   <div style={{display:"grid",gap:9}}>{result.results.map(x=><div key={x.id} style={{border:"1px solid #405061",borderRadius:12,padding:12,background:"#1a2532"}}>
    <strong>{x.name}</strong> <span style={{...mini,fontSize:10}}> {x.level.replace(/_/g," ")}</span>
    <div style={{...dim,fontSize:12,marginTop:4}}>Sources {x.sourceCount} · Officially verified {x.verifiedSourceCount} · Certified read-only {x.certifiedSourceCount} · Discovery: {x.discoveryStatus.replace(/_/g," ")}</div>
    {x.examples.map((v,i)=><div key={i} style={{...dim,fontSize:12}}>
     <SourceLink href={v.url}>{v.name}</SourceLink> · {v.certified?"Certified read-only":v.status.replace(/_/g," ")}
    </div>)}
    {x.examples.length===0&&<div style={{...dim,fontSize:12}}>No verified procurement source captured yet; source research required</div>}
    {x.inboxObservations.length>0&&<div style={{marginTop:9}}>
     <div style={{...mini,fontSize:10}}>Recorded solicitation observations · not bid-certified</div>
     {x.inboxObservations.map(o=><div key={o.id} style={{padding:"7px 0",borderTop:"1px solid #34424f"}}>
      <SourceLink href={o.sourceUrl}>{o.title}</SourceLink>
      <div style={{...dim,fontSize:11}}>Last recorded: {new Date(o.lastSeenAt).toLocaleDateString()} · Recheck official deadline and addenda</div>
      <button disabled={reviewing!==null} type="button" onClick={()=>void reviewInbox(o.id)} style={{...btn,marginTop:6,padding:"7px 10px",fontSize:12}}>Prepare no-send review</button>
      {reviews[o.id]&&<div style={{...dim,fontSize:11,padding:7,marginTop:5,border:"1px solid #655039",borderRadius:8}}>
       <strong>Review status: {reviews[o.id].status??"blocked"}</strong>
       <ul>{reviews[o.id].blockers.slice(0,7).map(b=><li key={b}>{b}</li>)}</ul>
      </div>}
     </div>)}
    </div>}

   </div>)}</div>
   <div style={{display:"flex",gap:8,alignItems:"center",marginTop:14}}>
    <button type="button" style={btn} disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Previous</button>
    <button type="button" style={btn} disabled={offset+20>=result.total} onClick={()=>setOffset(offset+20)}>Next</button>
   </div>
  </div>}
 </section>
}
export default function GovernmentProcurementWorkspace(){
 const [pilot,setPilot]=useState<Pilot|null>(null)
 const [sources,setSources]=useState<Source[]>([])
 const [snapshot,setSnapshot]=useState<number|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [samId,setSamId]=useState("")
 const [samDraft,setSamDraft]=useState<Draft|null>(null)
 const [selectedState,setSelectedState]=useState("CA")
 const [coverage,setCoverage]=useState<NationalReport|null>(null)
 const [reviewing,setReviewing]=useState(false)
 const [reviewingPilot,setReviewingPilot]=useState<string|null>(null)
 const [pilotDrafts,setPilotDrafts]=useState<Record<string,Draft>>({})
 async function load(){
  setLoading(true);setError("")
  try{
   const [pilotResponse,sourceResponse,nationalResponse]=await Promise.all([
    fetch("/api/opportunities/procurement?mode=pilot",{cache:"no-store"}),
    fetch("/api/opportunities/procurement?state="+encodeURIComponent(selectedState)+"&limit=35",{cache:"no-store"}),
    fetch("/api/opportunities/procurement/coverage",{cache:"no-store"})
   ])
   const a=await pilotResponse.json() as PilotResponse
   const b=await sourceResponse.json() as SourceResponse
   const n=await nationalResponse.json() as NationalResponse
   if(nationalResponse.ok&&n.ok)setCoverage(n.report??null)
   else{setCoverage(null);setError("National jurisdiction rollup unavailable; opportunity pilot is still usable.")}
   if(!pilotResponse.ok||!a.ok)throw new Error(a.error??"Could not load research pilot")
   setPilot(a.docket??null)
   if(sourceResponse.ok&&b.ok){setSources(b.decisions??[]);setSnapshot(b.scanned??0)}
   else{setSources([]);setSnapshot(null);setError("Source recovery registry unavailable. Pilot remains read-only.")}
  }catch(e){setError(e instanceof Error?e.message:"Procurement unavailable")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[selectedState])
 async function reviewPilot(pilotId:string){
  setReviewingPilot(pilotId);setError("")
  try{
   const res=await fetch("/api/opportunities/procurement",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({pilotId}),cache:"no-store"
   })
   const json=await res.json() as Draft
   if(!res.ok||!json.ok)throw new Error(json.error??"Pilot packet could not be prepared")
   setPilotDrafts(prev=>({...prev,[pilotId]:json}))
  }catch(e){setError(e instanceof Error?e.message:"Pilot evidence review failed")}
  finally{setReviewingPilot(null)}
 }
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
    <div style={mini}>National public procurement coverage</div>
    <h2 style={boxTitle}>Every state · 50 states + Washington, DC</h2>
    <p style={dim}>The known government inventory is nationwide, but this is <strong>not</strong> universal live-bid coverage. Official sources, certified parsers, and valid bid packages are measured separately. Territories, tribal buyers, township/dependent governments, and federal agencies require their own additional catalogs or existing SAM integration.</p>
    {coverage?<div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
      {[
       ["Jurisdictions",coverage.registryJurisdictions],
       ["With a source",coverage.sourceBearingJurisdictions],
       ["Officially verified",coverage.officiallyVerifiedJurisdictions],
       ["Certified read-only",coverage.certifiedReadOnlyJurisdictions],
       ["Discovery jobs blocked",coverage.blockedDiscoveryJobs],
       ["No search/domain",coverage.noProviderJobs],
      ].map(([name,value])=><div key={String(name)} style={{border:"1px solid #405361",padding:12,borderRadius:10,background:"#1b2835"}}>
       <div style={{...mini,fontSize:10}}>{name}</div><strong style={{fontSize:23}}>{Number(value).toLocaleString()}</strong>
      </div>)}
     </div>
     <p style={{...dim,fontSize:12}}>Coverage means records in the existing registry, not guaranteed government procurement access. The <a href="https://www.census.gov/library/publications/2026/econ/govtorg2225.html" style={link} target="_blank" rel="noreferrer">2025 Census government count</a> uses a different population of independent governments.</p>
     <label htmlFor="procurement-state-picker" style={mini}>Inspect state and source recovery queue</label>
     <select id="procurement-state-picker" value={selectedState} onChange={e=>setSelectedState(e.target.value)} style={{margin:"8px 0 12px",width:"100%",maxWidth:320,borderRadius:10,padding:12,background:"#111925",color:"#eff3f1",border:"1px solid #526273"}}>
      {coverage.states.map(x=><option key={x.state} value={x.state}>{x.state} · {x.jurisdictions.toLocaleString()} jurisdictions · {x.certifiedReadOnlyJurisdictions} certified</option>)}
     </select>
     <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",width:"100%",fontSize:12,minWidth:580}}>
       <thead><tr>{["State","Known","Source","Verified","Certified","Blocked"].map(h=><th key={h} style={{textAlign:"left",padding:9,borderBottom:"1px solid #526273"}}>{h}</th>)}</tr></thead>
       <tbody>{coverage.states.map(x=><tr key={x.state} style={{background:x.state===selectedState?"#26372e":"transparent"}}>
        <td style={{padding:8}}><button type="button" onClick={()=>setSelectedState(x.state)} style={{border:0,background:"transparent",color:"#92d7b0",cursor:"pointer",fontWeight:700}}>{x.state}</button></td>
        {[x.jurisdictions,x.sourceBearing,x.verifiedSourceJurisdictions,x.certifiedReadOnlyJurisdictions,x.blockedJobs].map((value,i)=><td key={i} style={{padding:8,borderBottom:"1px solid #2e3c49"}}>{value.toLocaleString()}</td>)}
       </tr>)}</tbody>
      </table>
     </div>
    </div>:<p style={dim}>National totals unavailable; the private source inventory remains the system of record.</p>}
   </section>
   <JurisdictionDirectory state={selectedState}/>
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
     <div style={{marginTop:16,display:"grid",gap:8}}>
      <button type="button" disabled={reviewingPilot!==null} onClick={()=>void reviewPilot(c.id)} style={{...btn,width:"fit-content",opacity:reviewingPilot!==null?0.6:1}}>
       {reviewingPilot===c.id?"Preparing review…":"Generate no-send bid review"}
      </button>
      {pilotDrafts[c.id]&&<div style={{border:"1px solid #8b6240",background:"#271f1a",borderRadius:12,padding:12}}>
       <div style={{fontWeight:700}}>Server review: {pilotDrafts[c.id]?.packet?.status??"Not ready"}</div>
       <p style={{...dim,fontSize:13}}>This packet cannot authorize outreach, a quote request, a bid, or spending. Missing evidence:</p>
       <ul style={{...dim,fontSize:13}}>{(pilotDrafts[c.id]?.packet?.blockers??[]).map(b=><li key={b}>{b}</li>)}</ul>
      </div>}
     </div>
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
     <h2 style={boxTitle}>{selectedState} official-source recovery</h2>
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
