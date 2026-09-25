"use client"

import { useEffect,useMemo,useState,type ReactNode } from "react"
import Link from "next/link"
import type { SamCommandCenterItem,SamCommandCenterResponse } from "@/lib/money-opportunities/sam-command-center"

type ApiResponse={success:boolean;data?:SamCommandCenterResponse;error?:string;blocker?:string}

export default function FederalContractsWorkspace(){
  const [data,setData]=useState<SamCommandCenterResponse>({items:[],summary:{total:0,readyForQuote:0,reviewRequired:0,blocked:0,providers:0}})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const [blocker,setBlocker]=useState("")

  useEffect(()=>{void load()},[])
  async function load(){
    setLoading(true);setError("");setBlocker("")
    try{
      const response=await fetch("/api/opportunities/sam?limit=50",{cache:"no-store"})
      const json=await response.json() as ApiResponse
      if(!response.ok){
        setBlocker(json.blocker??"")
        throw new Error(json.error||"Could not load Federal Contracts")
      }
      if(json.data)setData(json.data)
    }catch(err){setError(err instanceof Error?err.message:"Could not load Federal Contracts")}
    finally{setLoading(false)}
  }

  const sorted=useMemo(()=>[...data.items].sort((a,b)=>{
    const rank={ready_for_quote:0,review_required:1,not_generated:2,blocked:3}
    return rank[a.pursuitStatus]-rank[b.pursuitStatus]||(a.responseDeadline??"9999").localeCompare(b.responseDeadline??"9999")
  }),[data.items])

  return <main style={page}><div style={wrap}>
    <div style={topRow}>
      <div>
        <div style={eyebrow}>Jhadina Opportunity Core</div>
        <h1 style={h1}>Federal Contracts</h1>
        <p style={sub}>SAM.gov opportunities connected to solicitation requirements, subcontractability, real provider evidence, fulfillment teams, and commercial-readiness blockers.</p>
      </div>
      <Link href="/opportunity" style={backLink}>← Opportunities</Link>
    </div>

    <div style={metrics}>
      <Metric label="Contracts" value={data.summary.total}/>
      <Metric label="Ready for quote" value={data.summary.readyForQuote}/>
      <Metric label="Review" value={data.summary.reviewRequired}/>
      <Metric label="Blocked" value={data.summary.blocked}/>
      <Metric label="Provider matches" value={data.summary.providers}/>
    </div>

    <div style={authorityBanner}>
      <strong>Human-controlled pursuit.</strong> This workspace does not authorize provider outreach, bid submission, contract signature, or payment.
    </div>

    {error&&<div role="alert" style={warning}>
      <strong>{error}</strong>{blocker&&<div style={{marginTop:6}}>Runtime blocker: <code>{blocker}</code></div>}
    </div>}

    {loading?<p style={muted}>Loading Federal Contracts…</p>:
      sorted.length===0?<div style={empty}>
        <h2 style={emptyTitle}>No live SAM evidence yet.</h2>
        <p style={muted}>The autonomous scanner has not completed a live production run. Once commissioned, contracts and their fulfillment companies will appear here automatically.</p>
      </div>:
      sorted.map(item=><ContractCard key={item.noticeId} item={item}/>)
    }
  </div></main>
}

function ContractCard({item}:{item:SamCommandCenterItem}){
  const statusLabel=item.pursuitStatus==="ready_for_quote"?"Ready for quote":item.pursuitStatus==="review_required"?"Review required":item.pursuitStatus==="blocked"?"Blocked":"Enrichment pending"
  return <article style={card}>
    <div style={cardHeader}>
      <div>
        <div style={eyebrowSmall}>{item.agency||"Federal agency"}{item.office?" · "+item.office:""}</div>
        <h2 style={cardTitle}>{item.title}</h2>
      </div>
      <span style={statusBadge(item.pursuitStatus)}>{statusLabel}</span>
    </div>

    <div style={facts}>
      <Fact label="Deadline" value={date(item.responseDeadline)}/>
      <Fact label="NAICS" value={item.naicsCodes.join(", ")||"Not listed"}/>
      <Fact label="Set-aside" value={item.setAside||"Not listed"}/>
      <Fact label="Version" value={String(item.version)}/>
    </div>

    <Section title="Capture & award readiness">
      <div style={facts}>
        <Fact label="Notice stage" value={label(item.capture.stage)}/>
        <Fact label="Capture value" value={label(item.capture.captureValue)}/>
        <Fact label="Award readiness" value={label(item.capture.awardReadiness)}/>
      </div>
      {item.capture.reasons.length?item.capture.reasons.map(reason=><p key={reason} style={muted}>{reason}</p>):<p style={muted}>Capture analysis is still being generated for this notice.</p>}
    </Section>

    <Section title="Requirements">
      {item.requirements.length?<ul style={list}>{item.requirements.slice(0,8).map(req=><li key={req.id}>{req.label}</li>)}</ul>:<p style={muted}>Solicitation requirements are still being extracted.</p>}
      {item.requirements.length>8&&<p style={muted}>+ {item.requirements.length-8} more requirements</p>}
    </Section>

    <Section title="Subcontractability">
      <div style={inlineRow}>
        <span style={miniBadge}>{label(item.subcontractability.status)}</span>
        {item.subcontractability.detectedRules.map(rule=><span key={rule} style={ruleBadge}>{rule}</span>)}
      </div>
      {item.subcontractability.hardBlockers.map(x=><p key={x} style={blockerText}>⛔ {x}</p>)}
      {item.subcontractability.conditions.map(x=><p key={x} style={conditionText}>Review: {x}</p>)}
      {item.subcontractability.status==="unknown"&&<p style={muted}>Subcontractability analysis pending.</p>}
    </Section>

    <Section title="Matched companies">
      {item.providers.length?<div style={providerGrid}>{item.providers.slice(0,8).map(provider=><div key={provider.requirementId+provider.providerKey} style={providerCard}>
        <div style={{fontWeight:700}}>{provider.providerName}</div>
        <div style={mutedSmall}>{provider.country||"Country unknown"} · score {Math.round(provider.score)}</div>
        <div style={inlineRow}>
          <span style={miniBadge}>{label(provider.status)}</span>
          {provider.sourceTypes.map(source=><span key={source} style={sourceBadge}>{source.replaceAll("_"," ")}</span>)}
        </div>
        {(provider.uei||provider.cage)&&<div style={mutedSmall}>{provider.uei?"UEI "+provider.uei:""}{provider.uei&&provider.cage?" · ":""}{provider.cage?"CAGE "+provider.cage:""}</div>}
      </div>)}</div>:<p style={muted}>Provider discovery has not produced corroborated candidates yet.</p>}
    </Section>

    <Section title="Fulfillment team">
      {item.assignments.length?<div style={providerGrid}>{item.assignments.map(assignment=><div key={assignment.providerKey} style={providerCard}>
        <div style={{fontWeight:700}}>{assignment.providerName}</div>
        <div style={mutedSmall}>Covers {assignment.requirementIds.length} requirement{assignment.requirementIds.length===1?"":"s"} · score {Math.round(assignment.score)}</div>
        {assignment.reviewRequired&&<div style={conditionText}>Human review required</div>}
      </div>)}</div>:<p style={muted}>No evidence-backed fulfillment team has been assembled yet.</p>}
      {item.uncoveredRequirementIds.length>0&&<p style={blockerText}>Uncovered requirements: {item.uncoveredRequirementIds.join(", ")}</p>}
    </Section>

    <Section title="Quote & commercial readiness">
      <div style={facts}>
        <Fact label="Contract value" value={money(item.commercial.contractValue)}/>
        <Fact label="Provider cost" value={money(item.commercial.providerCost)}/>
        <Fact label="Gross profit" value={money(item.commercial.estimatedGrossProfit)}/>
        <Fact label="Margin" value={item.commercial.estimatedMarginPercent===null?"Pending quote":item.commercial.estimatedMarginPercent.toFixed(1)+"%"}/>
      </div>
      {item.quoteTargets.map(target=><p key={target.providerKey} style={conditionText}>Quote needed: {target.providerName} · {target.requirementIds.length} requirement{target.requirementIds.length===1?"":"s"}</p>)}
      {item.commercial.blockers.map(x=><p key={x} style={blockerText}>• {x}</p>)}
      {item.commercial.assumptions.map(x=><p key={x} style={muted}>{x}</p>)}
    </Section>

    {item.blockers.length>0&&<Section title="Pursuit blockers">{item.blockers.map(x=><p key={x} style={blockerText}>• {x}</p>)}</Section>}

    <div style={authorityRow}>
      <span>Outreach: <strong>not authorized</strong></span>
      <span>Bid: <strong>not authorized</strong></span>
      <span>Contract execution: <strong>not authorized</strong></span>
      <span>Payment: <strong>not authorized</strong></span>
    </div>
    <div style={actions}>
      <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={primaryLink}>Open SAM.gov ↗</a>
      <Link href={"/ask-jhadina?surface=opportunities&route=/opportunity/sam&noticeId="+encodeURIComponent(item.noticeId)} style={secondaryLink}>Ask Jhadina</Link>
    </div>
  </article>
}

function Section({title,children}:{title:string;children:ReactNode}){return <section style={section}><h3 style={sectionTitle}>{title}</h3>{children}</section>}
function Metric({label:caption,value}:{label:string;value:number}){return <div><div style={metricValue}>{value}</div><div style={metricLabel}>{caption}</div></div>}
function Fact({label:caption,value}:{label:string;value:string}){return <div style={{minWidth:130}}><div style={factLabel}>{caption}</div><div style={factValue}>{value}</div></div>}
function label(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}
function date(value?:string){if(!value)return"Not listed";const parsed=new Date(value);return Number.isNaN(parsed.getTime())?value:parsed.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}
function money(value:number|null){return value===null?"Pending quote":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value)}

const page={minHeight:"100vh",background:"linear-gradient(180deg,#f5f1ea,#edf2ed 55%,#f3eee8)",color:"#29332e",padding:"28px 18px 110px",fontFamily:'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif'}
const wrap={maxWidth:980,margin:"0 auto"}
const topRow={display:"flex",justifyContent:"space-between",gap:24,alignItems:"flex-start",flexWrap:"wrap" as const}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"}
const eyebrowSmall={fontSize:10,letterSpacing:".11em",textTransform:"uppercase" as const,color:"#758179"}
const h1={margin:"12px 0 8px",fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400 as const,fontSize:"clamp(36px,8vw,58px)",letterSpacing:"-.045em",lineHeight:1}
const sub={margin:0,color:"#718078",lineHeight:1.65,maxWidth:720}
const backLink={color:"#526158",textDecoration:"none",padding:"9px 12px",background:"rgba(255,255,255,.65)",borderRadius:999,border:"1px solid #d5ddd7"}
const metrics={display:"flex",gap:28,overflowX:"auto" as const,padding:"26px 2px 16px"}
const metricValue={fontSize:27,fontFamily:'Georgia,"Times New Roman",serif'}
const metricLabel={fontSize:10,textTransform:"uppercase" as const,letterSpacing:".12em",color:"#7d8982",whiteSpace:"nowrap" as const}
const authorityBanner={padding:14,borderRadius:16,background:"#e7eee9",color:"#52635a",fontSize:12,marginBottom:18}
const warning={padding:14,borderRadius:16,background:"#f3e7df",color:"#785849",marginBottom:18}
const empty={padding:26,borderRadius:24,background:"rgba(255,255,255,.72)",border:"1px solid #dce2dd"}
const emptyTitle={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400 as const,margin:"0 0 8px"}
const card={background:"rgba(255,255,255,.82)",border:"1px solid #dce2dd",borderRadius:26,padding:22,marginBottom:16,boxShadow:"0 10px 40px rgba(63,76,67,.05)"}
const cardHeader={display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",flexWrap:"wrap" as const}
const cardTitle={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400 as const,fontSize:27,margin:"8px 0 0"}
const facts={display:"flex",gap:24,overflowX:"auto" as const,marginTop:18,paddingBottom:4}
const factLabel={fontSize:9,textTransform:"uppercase" as const,letterSpacing:".12em",color:"#8b968f"}
const factValue={fontSize:12,fontWeight:650,color:"#3c4a43",marginTop:3}
const section={borderTop:"1px solid #e4e9e5",paddingTop:16,marginTop:18}
const sectionTitle={fontSize:12,textTransform:"uppercase" as const,letterSpacing:".12em",color:"#5c6961",margin:"0 0 10px"}
const list={margin:"0 0 0 18px",padding:0,color:"#526158",fontSize:12,lineHeight:1.7}
const inlineRow={display:"flex",gap:6,flexWrap:"wrap" as const,alignItems:"center",marginTop:6}
const providerGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:9}
const providerCard={padding:12,borderRadius:15,background:"#f2f4f1",border:"1px solid #e1e6e2",fontSize:12}
const muted={color:"#748078",fontSize:12,lineHeight:1.55,margin:"6px 0"}
const mutedSmall={color:"#7b867f",fontSize:10,marginTop:4}
const blockerText={color:"#8a574d",fontSize:11,lineHeight:1.5,margin:"6px 0"}
const conditionText={color:"#7a684d",fontSize:11,lineHeight:1.5,margin:"6px 0"}
const miniBadge={display:"inline-flex",padding:"5px 8px",borderRadius:999,background:"#e6eee8",color:"#52635a",fontSize:10}
const ruleBadge={display:"inline-flex",padding:"5px 8px",borderRadius:999,background:"#f0ece5",color:"#716451",fontSize:9}
const sourceBadge={display:"inline-flex",padding:"4px 7px",borderRadius:999,background:"#e8edf1",color:"#566675",fontSize:9}
const authorityRow={display:"flex",gap:14,flexWrap:"wrap" as const,padding:"12px 0 2px",color:"#7b5f55",fontSize:10}
const actions={display:"flex",gap:8,flexWrap:"wrap" as const,marginTop:14}
const primaryLink={textDecoration:"none",borderRadius:999,padding:"10px 14px",background:"#34453c",color:"white",fontSize:12}
const secondaryLink={textDecoration:"none",borderRadius:999,padding:"10px 14px",background:"#eef1ed",color:"#526158",fontSize:12}
function statusBadge(value:SamCommandCenterItem["pursuitStatus"]){
  const background=value==="ready_for_quote"?"#dfece2":value==="blocked"?"#f2dedb":value==="review_required"?"#f2ead9":"#e9ece9"
  const color=value==="ready_for_quote"?"#496353":value==="blocked"?"#85564e":value==="review_required"?"#786548":"#68746d"
  return {display:"inline-flex",padding:"7px 10px",borderRadius:999,background,color,fontSize:10,fontWeight:700}
}
