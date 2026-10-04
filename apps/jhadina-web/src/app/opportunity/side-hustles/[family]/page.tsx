'use client'

import Link from 'next/link'
import {Suspense,useEffect,useMemo,useState} from 'react'
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
type BusinessWorkItem={
  id:string
  ventureId:string
  agentId:string
  step:string
  status:'queued'|'running'|'waiting'|'blocked'|'completed'|'failed'|'superseded'
  updatedAt:string
  evidenceRefs:string[]
  spendUsd:number
  authorizationEffect:'NONE'
}
type BusinessPipeline={
  ventures:Array<{id:string;opportunityId:string;title:string;lifecycle:string;score:number}>
  workItems:BusinessWorkItem[]
  authority:'SIDE_HUSTLE_BUSINESS_FACTORY'
  externalActionAuthorized:false
}
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
  productionStatus:{
    readiness:string
    summary:string
    blockers:string[]
    nextMilestones:string[]
    liveCommercialEvidenceRequired:boolean
  }
  lanes:Lane[]
  matches:MatchRow[]
  businessPipeline:BusinessPipeline
  businessRef?:string
  businessRefs:string[]
  error?:string
}

export default function SideHustleRelationshipPage({params}:{params:{family:string}}){
  return <Suspense fallback={<main style={{maxWidth:1180,margin:'0 auto',padding:'30px 20px 72px'}}>Loading hustle relationships…</main>}>
    <SideHustleRelationshipContent params={params}/>
  </Suspense>
}

function SideHustleRelationshipContent({params}:{params:{family:string}}){
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
          <span style={{fontSize:12,padding:'5px 9px',border:'1px solid currentColor',borderRadius:999,opacity:.85}}>{payload.productionStatus.readiness.replace(/_/g,' ')}</span>
          {payload.definition.executionOwners.map(owner=><span key={owner} style={{fontSize:12,padding:'5px 9px',border:'1px solid currentColor',borderRadius:999,opacity:.7}}>{owner}</span>)}
        </div>
        <section style={{marginTop:20,padding:16,border:'1px solid color-mix(in srgb, currentColor 18%, transparent)',borderRadius:13}}>
          <div style={{fontSize:12,textTransform:'uppercase',letterSpacing:1,opacity:.55}}>Production readiness</div>
          <p style={{margin:'7px 0 0',lineHeight:1.5,opacity:.76}}>{payload.productionStatus.summary}</p>
          {payload.productionStatus.blockers.length?<div style={{marginTop:13}}>
            <strong style={{fontSize:13}}>Current blockers</strong>
            <ul style={{margin:'6px 0 0',paddingLeft:20,lineHeight:1.5,opacity:.72}}>{payload.productionStatus.blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>
          </div>:null}
          <div style={{marginTop:13}}>
            <strong style={{fontSize:13}}>Next production milestones</strong>
            <ol style={{margin:'6px 0 0',paddingLeft:20,lineHeight:1.5,opacity:.72}}>{payload.productionStatus.nextMilestones.map(step=><li key={step}>{step}</li>)}</ol>
          </div>
          <p style={{fontSize:12,margin:'12px 0 0',opacity:.55}}>Live commercial evidence required: {payload.productionStatus.liveCommercialEvidenceRequired?'yes':'no'}. This status grants no outreach, spend, publishing, bid, trading, or money-movement authority.</p>
        </section>
        {payload.businessRefs.length?<div style={{marginTop:18}}>
          <div style={{fontSize:12,textTransform:'uppercase',letterSpacing:1,opacity:.55,marginBottom:8}}>Businesses in this family</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Link href={'/opportunity/side-hustles/'+family} style={{color:'inherit',textDecoration:'none',padding:'7px 10px',border:'1px solid currentColor',borderRadius:999,opacity:businessRef?0.6:1}}>All</Link>
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

      <section style={{marginTop:34}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'baseline',flexWrap:'wrap'}}>
          <div>
            <h2 style={{fontSize:22,margin:'0 0 6px'}}>Business pipeline / Agent work</h2>
            <p style={{margin:0,opacity:.68,maxWidth:820}}>
              Operational work for this business family comes from the canonical Venture/Side Hustle Business Factory ledger. Blocked means evidence or another dependency is missing; queued means the work is ready for coordination. Neither state authorizes marketplace changes, outreach, spend, fulfillment, or money movement.
            </p>
          </div>
          <span style={{fontSize:12,opacity:.55}}>{payload.businessPipeline.workItems.length} work item(s)</span>
        </div>
        {payload.businessPipeline.ventures.length?<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:13}}>
          {payload.businessPipeline.ventures.map(venture=><span key={venture.id} style={{fontSize:12,padding:'5px 9px',border:'1px solid color-mix(in srgb, currentColor 20%, transparent)',borderRadius:999,opacity:.7}}>
            {venture.title} · {venture.lifecycle.replace(/_/g,' ')} · score {venture.score}
          </span>)}
        </div>:null}
        <div style={{display:'grid',gap:10,marginTop:15}}>
          {payload.businessPipeline.workItems.length?payload.businessPipeline.workItems.map(item=><article key={item.id} style={{border:'1px solid color-mix(in srgb, currentColor 20%, transparent)',borderRadius:13,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'baseline'}}>
              <strong style={{fontSize:14}}>{item.step.replace(/[:_]/g,' ')}</strong>
              <span style={{fontSize:12,opacity:.62}}>{item.status}</span>
            </div>
            <div style={{fontSize:12,opacity:.58,marginTop:5}}>{item.agentId.replace(/[:_]/g,' ')} · {item.evidenceRefs.length} evidence ref(s) · observed spend {String(item.spendUsd)} USD</div>
          </article>):<div style={{padding:18,border:'1px dashed currentColor',borderRadius:12,opacity:.62}}>No durable Business Factory work items for this family yet.</div>}
        </div>
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
