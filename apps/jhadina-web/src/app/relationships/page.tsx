'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'

type Entity={
  id:string
  kind:string
  display_name:string
  status:string
  evidence_refs:string[]
  updated_at:string
}

export default function RelationshipsPage(){
  const [entities,setEntities]=useState<Entity[]>([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)

  async function load(){
    setLoading(true)
    setError('')
    try{
      const response=await fetch('/api/relationships',{cache:'no-store'})
      const payload=await response.json() as {ok?:boolean;entities?:Entity[];error?:string}
      if(!response.ok||!payload.ok)throw new Error(payload.error??'Unable to load relationships')
      setEntities(payload.entities??[])
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Unable to load relationships')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{void load()},[])

  return <main style={{maxWidth:1120,margin:'0 auto',padding:'32px 20px 64px'}}>
    <header style={{display:'flex',justifyContent:'space-between',gap:24,alignItems:'flex-end',marginBottom:28}}>
      <div>
        <p style={{margin:0,fontSize:12,letterSpacing:1.5,textTransform:'uppercase',opacity:.62}}>Jhadina Relationship Core</p>
        <h1 style={{margin:'6px 0 8px',fontSize:36}}>Relationships</h1>
        <p style={{margin:0,opacity:.72,maxWidth:700}}>One owner-scoped record for companies and people across SAM, public opportunities, growth, commerce, social, files, tasks and agent work.</p>
      </div>
      <button onClick={()=>void load()} disabled={loading} style={{padding:'10px 14px',borderRadius:10,border:'1px solid currentColor',background:'transparent',cursor:'pointer'}}>Refresh</button>
    </header>

    {error?<div role="alert" style={{padding:16,border:'1px solid currentColor',borderRadius:12,marginBottom:20}}>{error}</div>:null}
    {loading?<p>Loading relationship records…</p>:null}
    {!loading&&!entities.length?<section style={{padding:28,border:'1px dashed currentColor',borderRadius:14,opacity:.75}}>
      <h2 style={{marginTop:0}}>No relationship records yet</h2>
      <p style={{marginBottom:0}}>The production backfill and live domain bridges populate this workspace from evidence-backed source records. No placeholder companies are generated.</p>
    </section>:null}

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14}}>
      {entities.map(entity=><Link key={entity.id} href={'/relationships/'+encodeURIComponent(entity.id)} style={{color:'inherit',textDecoration:'none',border:'1px solid color-mix(in srgb, currentColor 22%, transparent)',borderRadius:14,padding:18}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start'}}>
          <div>
            <div style={{fontSize:12,textTransform:'uppercase',letterSpacing:1,opacity:.58}}>{entity.kind}</div>
            <h2 style={{fontSize:19,margin:'5px 0 7px'}}>{entity.display_name}</h2>
          </div>
          <span style={{fontSize:12,opacity:.65}}>{entity.status}</span>
        </div>
        <div style={{fontSize:12,opacity:.58,overflowWrap:'anywhere'}}>{entity.id}</div>
        <div style={{marginTop:14,fontSize:12,opacity:.62}}>Updated {new Date(entity.updated_at).toLocaleString()}</div>
      </Link>)}
    </section>
  </main>
}
