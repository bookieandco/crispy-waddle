'use client'

import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import {useSearchParams} from 'next/navigation'

type Entity={id:string;display_name:string;kind:string;status:string;updated_at:string}
type RecordRow={
  id:string
  entity_id:string
  pipeline_id:string
  stage_id:string
  values_json:Record<string,unknown>
  updated_at:string
  entity:Entity|null
}
type Lane={id:string;label:string;description:string;pipelineIds:string[];records:RecordRow[]}
type MatchRow={
  id:string
  from_entity_id:string
  to_entity_id:string
  relation:string
  context_ref?:string
  valid_from:string
  evidence_refs:string[]
}
type Payload={
  ok:boolean
  definition:{family:string;label:string;defaultRole:string;executionOwners:string[];monetizationModels:string[]}
  scope:{lanes:Array<{id:string;label:string;description:string}>}
  lanes:Lane[]
  matches:MatchRow[]
  businessRef?:string
  businessRefs:string[]
  error?:string
}

export default function SideHustleRelationshipPage({params}:{params:{family:string}}){
  const family=decodeURIComponent(params.family)
  const searchParams=useSearchParams()
  const businessRef=searchParams.get('business')?.trim()||''
  const [payload,setPayload]=useState<Payload|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)

  async function load(){
    setLoading(true);setError('')
    try{
      const query=businessRef?'?business='+encodeURIComponent(businessRef):''
      const response=await fetch('/api/side-hustles/'+encodeURIComponent(family)+'/relationships'+query,{cache:'no-store'})
      const body=await response.json() as Payload
      if(!response.ok||!body.ok)throw new Error(body.error??'Unable to load Side Hustle relationships')
      setPayload(body)
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Unable to load Side Hustle relationships')
    }finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[family,businessRef])

  const entities=useMemo(()=>{
    const map=new Map<string,Entity>()
    for(const lane of payload?.lanes??[])for(const row of lane.records){
      if(row.entity)map.set(row.entity.id,row.entity)
    }
    return map
  },[payload])

  return <main style={{maxWidth:1180,margin:'0 auto',padding:'30px 20px 72px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:18}}>
      <Link href="/opportunity/side-hustles" style={{color:'inherit',opacity:.68,textDecoration:'none'}}>← Side Hustles</Link>
      <button onClick={()=>void load()} disabled={loading} style={{padding:'9px 13px',border:'1px solid currentColor',borderRadius:10,background:'transparent',cursor:'pointer'}}>Refresh</button>
    </div>
    {loading?<p style={{marginTop:26}}>Loading hustle relationships…</p>:null}
    {error?<div role="alert" style={{marginTop:24,padding:16,border:'1px solid currentColor',borderRadius:12}}>{error}</div>:null}
    {payload?<>
      <header style={{margin:'25px 0 28px'}}>
        <p style={{fontSize:12,textTransform:'uppercase',letterSpacing:1.3,opacity:.58,margin:0}}>Side Hustle · {payload.definition.defaultRole.replace(/_/g,' ')}</p>
        <h1 style={{fontSize:36,margin:'7px 0 8px'}}>{payload.definition.label}</h1>
        <p style={{margin:0,opacity:.7,maxWidth:820,lineHeight:1.5}}>
          This view is isolated to this business. Identity still comes from the shared Relationship Core; opportunities still belong to Opportunity Core. A pipeline stage can organize work, but it never authorizes outreach, bids, spending or other consequential execution.
        </p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
          {payload.definition.executionOwners.map(owner=><span key={owner} style={{fontSize:12,padding:'5px 9px',border:'1px solid currentColor',borderRadius:999,opacity:.7}}>{owner}</span>)}
        </div>
        {payload.businessRefs.length?<div style={{marginTop:18}}>
          <div style={{fontSize:12,textTransform:'uppercase',letterSpacing:1,opacity:.55,marginBottom:8}}>Businesses in this family</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Link href={'/opportunity/side-hustles/'+family} style={{color:'inherit',textDecoration:'none',padding:'7px 10px',border:'1px solid currentColor',borderRadius:999,opacity:businessRef?.6:1}}>All</Link>
            {payload.businessRefs.map(ref=><Link key={ref} href={'/opportunity/side-hustles/'+family+'?business='+encodeURIComponent(ref)}
              style={{color:'inherit',textDecoration:'none',padding:'7px 10px',border:'1px solid currentColor',borderRadius:999,opacity:businessRef===ref?1:.6}}>{ref}</Link>)}
          </div>
        </div>:null}
      </header>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14}}>
        {payload.lanes.map(lane=><article key={lane.id} style={{border:'1px solid color-mix(in srgb, currentColor 20%, transparent)',borderRadius:15,padding:17}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
            <h2 style={{fontSize:19,margin:'0 0 5px'}}>{lane.label}</h2>
            <span style={{fontSize:12,opacity:.55}}>{lane.records.length}</span>
          </div>
          <p style={{fontSize:13,opacity:.66,lineHeight:1.45,minHeight:38}}>{lane.description}</p>
          <div style={{display:'grid',gap:8,marginTop:13}}>
            {lane.records.length?lane.records.map(row=><Link key={row.id} href={'/relationships/'+encodeURIComponent(row.entity_id)}
              style={{color:'inherit',textDecoration:'none',padding:'10px 11px',border:'1px solid color-mix(in srgb, currentColor 15%, transparent)',borderRadius:10}}>
              <strong style={{display:'block',fontSize:14}}>{row.entity?.display_name??row.entity_id}</strong>
              <span style={{fontSize:12,opacity:.62}}>{row.pipeline_id.replace(/_/g,' ')} → {row.stage_id.replace(/_/g,' ')}</span>
              {typeof row.values_json.matchScore==='number'?<span style={{display:'block',fontSize:12,opacity:.62,marginTop:3}}>Match score {String(row.values_json.matchScore)}</span>:null}
            </Link>):<div style={{fontSize:13,opacity:.55,padding:'8px 0'}}>No evidence-backed relationships in this lane yet.</div>}
          </div>
        </article>)}
      </section>

      {family==='procurement_subcontracting'?<section style={{marginTop:34}}>
        <h2 style={{fontSize:22,marginBottom:6}}>Prime ↔ Subcontractor matches</h2>
        <p style={{marginTop:0,opacity:.68,maxWidth:800}}>Pairings are calculated per opportunity/work package from capability, classifications, geography, capacity, freshness and source evidence. They are research recommendations, not contact authorization.</p>
        <div style={{display:'grid',gap:10,marginTop:15}}>
          {payload.matches.length?payload.matches.map(match=>{
            const prime=entities.get(match.from_entity_id)
            const sub=entities.get(match.to_entity_id)
            return <article key={match.id} style={{border:'1px solid color-mix(in srgb, currentColor 20%, transparent)',borderRadius:13,padding:15}}>
              <div style={{fontWeight:650}}>
                {prime?.display_name??match.from_entity_id} <span style={{opacity:.5}}>↔</span> {sub?.display_name??match.to_entity_id}
              </div>
              <div style={{fontSize:12,opacity:.62,marginTop:5}}>{match.relation.replace(/_/g,' ')} · {match.context_ref??'work package context'}</div>
              <div style={{fontSize:12,opacity:.55,marginTop:3}}>{match.evidence_refs.length} evidence reference(s)</div>
            </article>
          }):<div style={{padding:18,border:'1px dashed currentColor',borderRadius:12,opacity:.62}}>No prime/subcontractor pairs yet. Matching will populate automatically when awarded-prime, work-package and provider-candidate evidence arrives.</div>}
        </div>
      </section>:null}
    </>:null}
  </main>
}
