"use client"

import { useEffect,useMemo,useState } from "react"
import Link from "next/link"

type Row={
  external_id:string
  title:string
  prime_name:string
  description?:string|null
  closing_date?:string|null
  performance_start_date?:string|null
  place_of_performance?:string|null
  naics_code?:string|null
  naics_label?:string|null
  contact_name?:string|null
  contact_email?:string|null
  contact_phone?:string|null
  source_url:string
  last_seen_at?:string|null
}
type Payload={
  success:boolean
  error?:string
  blocker?:string
  data?:{
    opportunities:Row[]
    summary:{total:number;closingSoon:number;withNaics:number;withContact:number}
    authority:{outreachAuthorized:false;quoteSubmissionAuthorized:false;contractSignatureAuthorized:false;paymentAuthorized:false}
  }
}

export default function SubnetWorkspace(){
  const [rows,setRows]=useState<Row[]>([])
  const [summary,setSummary]=useState({total:0,closingSoon:0,withNaics:0,withContact:0})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const [blocker,setBlocker]=useState("")

  useEffect(()=>{void load()},[])
  async function load(){
    setLoading(true);setError("");setBlocker("")
    try{
      const response=await fetch("/api/opportunities/subnet?limit=200",{cache:"no-store"})
      const json=await response.json() as Payload
      if(!response.ok){
        setBlocker(json.blocker??"")
        throw new Error(json.error||"Could not load SBA SUBNet")
      }
      setRows(json.data?.opportunities??[])
      if(json.data?.summary)setSummary(json.data.summary)
    }catch(err){setError(err instanceof Error?err.message:"Could not load SBA SUBNet")}
    finally{setLoading(false)}
  }

  const ordered=useMemo(()=>[...rows].sort((a,b)=>(a.closing_date??"9999").localeCompare(b.closing_date??"9999")), [rows])

  return <main style={pageStyle}><div style={wrap}>
    <div style={top}>
      <div>
        <div style={eyebrow}>Jhadina Opportunity Core</div>
        <h1 style={h1}>Prime Subcontracting</h1>
        <p style={sub}>SBA SUBNet opportunities posted by primes looking for subcontractors and suppliers. Listings are discovery evidence, not permission to contact, quote, sign, or pay.</p>
      </div>
      <Link href="/opportunity" style={back}>← Opportunities</Link>
    </div>

    <div style={metrics}>
      <Metric label="Open listings" value={summary.total}/>
      <Metric label="Closing soon" value={summary.closingSoon}/>
      <Metric label="With NAICS" value={summary.withNaics}/>
      <Metric label="With contact" value={summary.withContact}/>
    </div>

    <div style={guard}><strong>Human-controlled pursuit.</strong> Contact details are displayed because SBA publishes them for the listing. Jhadina does not automatically email/call the prime or submit a quote.</div>

    {error&&<div style={warning} role="alert"><strong>{error}</strong>{blocker&&<div>Runtime blocker: <code>{blocker}</code></div>}</div>}
    {loading?<p style={muted}>Loading SBA SUBNet…</p>:
      ordered.length===0?<div style={empty}><h2 style={emptyTitle}>No live SUBNet records yet.</h2><p style={muted}>The source adapter is ready, but no successful production scan has populated the catalog.</p></div>:
      ordered.map(row=><article key={row.external_id} style={card}>
        <div style={cardTop}>
          <div>
            <div style={eyebrowSmall}>{row.prime_name}</div>
            <h2 style={title}>{row.title}</h2>
          </div>
          <span style={badge}>{row.closing_date?date(row.closing_date):"No closing date"}</span>
        </div>

        {row.description&&<p style={body}>{row.description}</p>}

        <div style={facts}>
          <Fact label="Place" value={row.place_of_performance||"Not listed"}/>
          <Fact label="NAICS" value={row.naics_code?row.naics_code+(row.naics_label?" · "+row.naics_label:""):"Not listed"}/>
          <Fact label="Performance start" value={row.performance_start_date?date(row.performance_start_date):"Not listed"}/>
        </div>

        <section style={section}>
          <h3 style={sectionTitle}>Posted point of contact</h3>
          <div style={contactLine}>{[row.contact_name,row.contact_email,row.contact_phone].filter(Boolean).join(" · ")||"Not listed"}</div>
        </section>

        <div style={authorityRow}>
          <span>Outreach: <strong>not authorized</strong></span>
          <span>Quote: <strong>not authorized</strong></span>
          <span>Signature: <strong>not authorized</strong></span>
        </div>
        <div style={actions}>
          <a href={row.source_url} target="_blank" rel="noreferrer" style={primary}>Open SBA SUBNet ↗</a>
          <Link href={"/ask-jhadina?surface=opportunities&route=/opportunity/subnet&subnetId="+encodeURIComponent(row.external_id)} style={secondary}>Ask Jhadina</Link>
        </div>
      </article>)
    }
  </div></main>
}

function Metric({label,value}:{label:string;value:number}){return <div><div style={metricValue}>{value}</div><div style={metricLabel}>{label}</div></div>}
function Fact({label,value}:{label:string;value:string}){return <div style={{minWidth:150}}><div style={factLabel}>{label}</div><div style={factValue}>{value}</div></div>}
function date(value:string){const d=new Date(value+"T00:00:00");return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}

const pageStyle={minHeight:"100vh",background:"linear-gradient(180deg,#f5f1ea,#edf2ed 55%,#f3eee8)",color:"#29332e",padding:"28px 18px 110px",fontFamily:'ui-rounded,"Avenir Next",Avenir,system-ui,sans-serif'}
const wrap={maxWidth:940,margin:"0 auto"}
const top={display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start",flexWrap:"wrap" as const}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"}
const eyebrowSmall={fontSize:10,letterSpacing:".11em",textTransform:"uppercase" as const,color:"#758179"}
const h1={margin:"12px 0 8px",fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400 as const,fontSize:"clamp(36px,8vw,56px)",letterSpacing:"-.045em",lineHeight:1}
const sub={margin:0,color:"#718078",lineHeight:1.65,maxWidth:720}
const back={color:"#526158",textDecoration:"none",padding:"9px 12px",background:"rgba(255,255,255,.65)",borderRadius:999,border:"1px solid #d5ddd7"}
const metrics={display:"flex",gap:28,overflowX:"auto" as const,padding:"26px 2px 16px"}
const metricValue={fontSize:27,fontFamily:'Georgia,"Times New Roman",serif'}
const metricLabel={fontSize:10,textTransform:"uppercase" as const,letterSpacing:".12em",color:"#7d8982",whiteSpace:"nowrap" as const}
const guard={padding:14,borderRadius:16,background:"#e7eee9",color:"#52635a",fontSize:12,marginBottom:18}
const warning={padding:14,borderRadius:16,background:"#f3e7df",color:"#785849",marginBottom:18}
const empty={padding:26,borderRadius:24,background:"rgba(255,255,255,.72)",border:"1px solid #dce2dd"}
const emptyTitle={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400 as const,margin:"0 0 8px"}
const muted={color:"#748078",fontSize:12,lineHeight:1.55}
const card={background:"rgba(255,255,255,.82)",border:"1px solid #dce2dd",borderRadius:24,padding:20,marginBottom:14,boxShadow:"0 10px 40px rgba(63,76,67,.05)"}
const cardTop={display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",flexWrap:"wrap" as const}
const title={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400 as const,fontSize:25,margin:"7px 0 0"}
const body={color:"#657169",lineHeight:1.6,fontSize:12}
const badge={display:"inline-flex",padding:"7px 10px",borderRadius:999,background:"#f0ece2",color:"#75654e",fontSize:10}
const facts={display:"flex",gap:22,overflowX:"auto" as const,marginTop:16}
const factLabel={fontSize:9,textTransform:"uppercase" as const,letterSpacing:".12em",color:"#8b968f"}
const factValue={fontSize:11,fontWeight:650,color:"#3c4a43",marginTop:3}
const section={borderTop:"1px solid #e4e9e5",marginTop:16,paddingTop:14}
const sectionTitle={fontSize:10,textTransform:"uppercase" as const,letterSpacing:".12em",color:"#66736b",margin:"0 0 6px"}
const contactLine={fontSize:11,color:"#59675f",wordBreak:"break-word" as const}
const authorityRow={display:"flex",gap:14,flexWrap:"wrap" as const,padding:"14px 0 2px",color:"#7b5f55",fontSize:10}
const actions={display:"flex",gap:8,flexWrap:"wrap" as const,marginTop:12}
const primary={textDecoration:"none",borderRadius:999,padding:"10px 14px",background:"#34453c",color:"white",fontSize:12}
const secondary={textDecoration:"none",borderRadius:999,padding:"10px 14px",background:"#eef1ed",color:"#526158",fontSize:12}
