'use client'

import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'

const TABS=['Overview','People','Opportunities','Interactions','Files','Tasks','Evidence','Agent','Timeline'] as const
type Tab=typeof TABS[number]
type Row=Record<string,unknown>
type ApiRecord={
  workspace:{
    entityId:string
    displayName:string
    tabs:readonly string[]
    overview:{kind:string;roles:string[];identities:string[];verifiedFactCount:number;pendingSuggestionCount:number}
    interactions:Array<{type:string;summary:string;occurredAt:string;contextRef?:string}>
    linkedContexts:Array<{kind:string;ref:string;relation:string}>
    agent:{queued:Row[];active:Row[];nextDueAt?:string;requiresReview:boolean}
  }
  edges:Row[]
  intelligence:Row[]
}

function pretty(value:unknown){
  if(value===null||value===undefined)return '—'
  if(typeof value==='string')return value
  return JSON.stringify(value)
}

export default function RelationshipDetailPage({params}:{params:{entityId:string}}){
  const entityId=decodeURIComponent(params.entityId)
  const [record,setRecord]=useState<ApiRecord|null>(null)
  const [evidence,setEvidence]=useState<{observations:Row[];facts:Row[];suggestions:Row[]}|null>(null)
  const [pipeline,setPipeline]=useState<Row[]>([])
  const [agent,setAgent]=useState<{queued:Row[];active:Row[];completed:Row[];blocked:Row[];executionAuthority:boolean}|null>(null)
  const [tab,setTab]=useState<Tab>('Overview')
  const [error,setError]=useState('')

  useEffect(()=>{
    let cancelled=false
    async function load(){
      try{
        const [recordResponse,evidenceResponse,pipelineResponse,agentResponse]=await Promise.all([
          fetch('/api/relationships/'+encodeURIComponent(entityId),{cache:'no-store'}),
          fetch('/api/relationships/'+encodeURIComponent(entityId)+'/evidence',{cache:'no-store'}),
          fetch('/api/relationships/'+encodeURIComponent(entityId)+'/pipeline',{cache:'no-store'}),
          fetch('/api/relationships/'+encodeURIComponent(entityId)+'/agent',{cache:'no-store'}),
        ])
        const [r,e,p,a]=await Promise.all([recordResponse.json(),evidenceResponse.json(),pipelineResponse.json(),agentResponse.json()])
        if(!recordResponse.ok)throw new Error(r.error??'Relationship not found')
        if(cancelled)return
        setRecord(r.record)
        setEvidence(e.evidence??null)
        setPipeline(p.pipeline??[])
        setAgent(a.agent??null)
      }catch(cause){
        if(!cancelled)setError(cause instanceof Error?cause.message:'Unable to load relationship')
      }
    }
    void load()
    return()=>{cancelled=true}
  },[entityId])

  const contexts=record?.workspace.linkedContexts??[]
  const people=record?.edges.filter(row=>row.relation==='works_for'||row.relation==='contact_for'||row.relation==='decision_maker')??[]
  const files=contexts.filter(row=>row.kind==='file'||row.kind==='document')
  const tasks=contexts.filter(row=>row.kind==='task')
  const opportunities=contexts.filter(row=>row.kind==='opportunity')
  const rows=useMemo(()=>{
    if(tab==='People')return people
    if(tab==='Opportunities')return opportunities
    if(tab==='Files')return files
    if(tab==='Tasks')return tasks
    if(tab==='Interactions')return record?.workspace.interactions??[]
    if(tab==='Timeline')return record?.workspace.interactions??[]
    return []
  },[tab,people,opportunities,files,tasks,record])

  return <main style={{maxWidth:1180,margin:'0 auto',padding:'28px 20px 64px'}}>
    <Link href="/relationships" style={{color:'inherit',opacity:.7}}>← Relationships</Link>
    {error?<div role="alert" style={{marginTop:24,padding:16,border:'1px solid currentColor',borderRadius:12}}>{error}</div>:null}
    {!record&&!error?<p style={{marginTop:28}}>Loading relationship workspace…</p>:null}
    {record?<>
      <header style={{margin:'24px 0 18px'}}>
        <p style={{fontSize:12,letterSpacing:1.2,textTransform:'uppercase',opacity:.58,margin:0}}>{record.workspace.overview.kind}</p>
        <h1 style={{fontSize:34,margin:'6px 0'}}>{record.workspace.displayName}</h1>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {record.workspace.overview.roles.map(role=><span key={role} style={{padding:'5px 9px',border:'1px solid currentColor',borderRadius:999,fontSize:12,opacity:.72}}>{role}</span>)}
        </div>
      </header>
      <nav aria-label="Relationship workspace" style={{display:'flex',gap:6,overflowX:'auto',padding:'8px 0 16px',position:'sticky',top:0,background:'Canvas',zIndex:2}}>
        {TABS.map(name=><button key={name} onClick={()=>setTab(name)} style={{whiteSpace:'nowrap',padding:'9px 12px',borderRadius:10,border:'1px solid currentColor',background:tab===name?'currentColor':'transparent',color:tab===name?'CanvasText':'inherit',cursor:'pointer'}}>{name}</button>)}
      </nav>

      {tab==='Overview'?<section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
        <Card title="Identity">{record.workspace.overview.identities.length?record.workspace.overview.identities.join('\n'):'No verified durable identity yet.'}</Card>
        <Card title="Facts">{record.workspace.overview.verifiedFactCount+' verified · '+record.workspace.overview.pendingSuggestionCount+' review'}</Card>
        <Card title="Pipeline">{pipeline.length?pipeline.map(row=>String(row.pipeline_id)+' → '+String(row.stage_id)).join('\n'):'No active pipeline.'}</Card>
        <Card title="Next work">{record.workspace.agent.nextDueAt?new Date(record.workspace.agent.nextDueAt).toLocaleString():'No due work.'}</Card>
        <div style={{gridColumn:'1 / -1'}}>
          <h2>Relationship intelligence</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10}}>
            {record.intelligence.length?record.intelligence.map(row=><Card key={String(row.id)} title={String(row.signal_type??'Signal')}>{String(row.summary??pretty(row.value_json))}</Card>):<p style={{opacity:.68}}>No derived signals yet. Signals are analysis-only and never promoted to facts automatically.</p>}
          </div>
        </div>
      </section>:null}

      {tab==='Evidence'?<section>
        <h2>Evidence ledger</h2>
        <h3>Verified facts</h3><Rows rows={evidence?.facts??[]}/>
        <h3>Observations</h3><Rows rows={evidence?.observations??[]}/>
        <h3>Review suggestions</h3><Rows rows={evidence?.suggestions??[]}/>
      </section>:null}

      {tab==='Agent'?<section>
        <h2>Agent work</h2>
        <p style={{opacity:.68}}>CRM work can research and recheck context. It cannot authorize outreach, spending, publishing, signing or other consequential execution.</p>
        <h3>Active</h3><Rows rows={agent?.active??[]}/>
        <h3>Queued</h3><Rows rows={agent?.queued??[]}/>
        <h3>Completed</h3><Rows rows={agent?.completed??[]}/>
        <h3>Errors / awaiting lease recovery</h3><Rows rows={agent?.blocked??[]}/>
      </section>:null}

      {!['Overview','Evidence','Agent'].includes(tab)?<section><h2>{tab}</h2><Rows rows={rows as Row[]}/></section>:null}
    </>:null}
  </main>
}

function Card({title,children}:{title:string;children:string}){
  return <article style={{border:'1px solid color-mix(in srgb, currentColor 22%, transparent)',borderRadius:14,padding:16,minHeight:100}}>
    <div style={{fontSize:12,textTransform:'uppercase',letterSpacing:1,opacity:.55}}>{title}</div>
    <div style={{marginTop:8,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{children}</div>
  </article>
}

function Rows({rows}:{rows:Row[]}){
  if(!rows.length)return <p style={{opacity:.58}}>Nothing recorded.</p>
  return <div style={{display:'grid',gap:8}}>
    {rows.map((row,index)=><article key={String(row.id??row.ref??index)} style={{border:'1px solid color-mix(in srgb, currentColor 18%, transparent)',borderRadius:12,padding:14}}>
      {Object.entries(row).slice(0,8).map(([key,value])=><div key={key} style={{display:'grid',gridTemplateColumns:'minmax(110px,180px) 1fr',gap:12,padding:'3px 0',fontSize:13}}>
        <strong style={{opacity:.62}}>{key}</strong><span style={{overflowWrap:'anywhere'}}>{pretty(value)}</span>
      </div>)}
    </article>)}
  </div>
}
