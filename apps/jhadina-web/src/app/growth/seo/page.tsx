'use client'

import { useEffect, useState } from 'react'

type Site={ventureId:string;website:string;gscConfigured:boolean}
type Finding={issue?:string;url?:string;sourceUrl?:string;targetUrl?:string;priority?:string;severity?:string}
type Report=Record<string,any>
const shell={maxWidth:820,margin:'0 auto',padding:'28px 16px 120px',fontFamily:'system-ui, sans-serif'} as const
const panel={background:'rgba(255,255,255,.77)',color:'#29332e',border:'1px solid #dce4df',borderRadius:22,padding:18,marginTop:16} as const
const action={background:'#2f4339',color:'#fff',padding:'12px 16px',borderRadius:14,border:0,fontWeight:700,cursor:'pointer'} as const
const secondary={background:'transparent',border:'1px solid #bdc8c0',borderRadius:14,padding:'11px 14px',color:'#304439',fontWeight:650,cursor:'pointer'} as const

export default function PersonalSeoWorkspace(){
  const [sites,setSites]=useState<Site[]>([])
  const [siteId,setSiteId]=useState('')
  const [mode,setMode]=useState<'crawl'|'gsc'|'pagespeed'>('crawl')
  const [strategy,setStrategy]=useState<'mobile'|'desktop'>('mobile')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [report,setReport]=useState<Report|null>(null)
  useEffect(()=>{
    let open=true
    fetch('/api/growth/seo',{cache:'no-store'}).then(async r=>{
      const v=await r.json()
      if(!r.ok)throw new Error(v.error||'Unable to load owned sites')
      if(open){setSites(v.sites??[]);setSiteId(v.sites?.[0]?.ventureId??'')}
    }).catch(e=>{if(open)setError(String(e instanceof Error?e.message:e))})
    return ()=>{open=false}
  },[])
  async function scan(){
    if(!siteId||busy)return
    setBusy(true);setError('');setReport(null)
    try{
      const res=await fetch('/api/growth/seo',{
        method:'POST',cache:'no-store',headers:{'content-type':'application/json'},
        body:JSON.stringify({ventureId:siteId,mode,strategy}),
      })
      const data=await res.json()
      if(!res.ok||!data.ok)throw new Error(data.error||'Scan unavailable')
      setReport(data.report)
    }catch(e){setError(e instanceof Error?e.message:'Scan unavailable')}
    finally{setBusy(false)}
  }
  const payload=report?.report??report
  const site=sites.find(x=>x.ventureId===siteId)
  const technical=payload?.diagnostics?.findings as Finding[]|undefined
  const links=payload?.links?.findings as Finding[]|undefined
  const speeds=payload?.report?.scores
  const gsc=payload?.report?.rows as Array<{query:string;clicks:number;impressions:number;position:number}>|undefined
  return <main style={{minHeight:'100vh',background:'linear-gradient(180deg,#f5f1ea,#edf2ed)',color:'#29332e'}}>
    <div style={shell}>
      <a href="/growth" style={{color:'#4c6255',fontSize:14}}>← Growth</a>
      <p style={{fontSize:11,letterSpacing:2,marginTop:22}}>JHADINA / PERSONAL SEO INTELLIGENCE</p>
      <h1 style={{fontSize:'clamp(32px,7vw,47px)',fontFamily:'Georgia,serif',fontWeight:400,margin:'5px 0'}}>Keep your sites healthy.</h1>
      <p style={{color:'#596e62',maxWidth:600,lineHeight:1.65}}>Read-only website diagnostics, search performance and approved improvement planning. No changes are published here.</p>
      <section style={panel}>
        <label htmlFor="site" style={{fontSize:13,fontWeight:700}}>Verified owned business</label>
        <select id="site" value={siteId} onChange={e=>{setSiteId(e.target.value);setReport(null)}}
          style={{display:'block',width:'100%',fontSize:15,margin:'8px 0 18px',padding:12,borderRadius:12}}>
          {!sites.length&&<option value="">No registered site</option>}
          {sites.map(s=><option key={s.ventureId} value={s.ventureId}>{s.website}</option>)}
        </select>
        <div role="group" aria-label="SEO measurement" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
          {([['crawl','Site audit'],['pagespeed','Page speed'],['gsc','Google search']] as const).map(([value,label])=>
            <button key={value} onClick={()=>{setMode(value);setReport(null)}}
              aria-pressed={mode===value} style={mode===value?action:secondary}>{label}</button>)}
        </div>
        {mode==='pagespeed'&&<label>Device&nbsp;
          <select value={strategy} onChange={e=>setStrategy(e.target.value as 'mobile'|'desktop')}
            style={{padding:9,borderRadius:10}}>
            <option value="mobile">Mobile</option><option value="desktop">Desktop</option>
          </select>
        </label>}
        {mode==='gsc'&&!site?.gscConfigured&&<p style={{fontSize:13}}>Search Console property is not yet registered for this site.</p>}
        <div style={{marginTop:17}}>
          <button disabled={busy||!siteId||(mode==='gsc'&&!site?.gscConfigured)}
            style={{...action,opacity:busy||!siteId?0.6:1}} onClick={scan}>
            {busy?'Reading source evidence…':'Run read-only check'}
          </button>
        </div>
        {!sites.length&&<p style={{fontSize:13,color:'#8a554d'}}>Configuration needed: register an owned venture and HTTPS site in private runtime settings.</p>}
      </section>
      {error&&<p role="alert" style={{color:'#9b443e',padding:12}}>{error}</p>}
      {report&&<section style={panel} aria-live="polite">
        <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:28,marginTop:0}}>Observed results</h2>
        <p style={{fontSize:12,color:'#65756d'}}>Source: {String(payload?.source??payload?.report?.source??'Owner-read provider')} · Evidence is partial, not a ranking or sales guarantee.</p>
        {mode==='crawl'&&<>
          <p><strong>{payload?.diagnostics?.scannedPageCount??0}</strong> inspected pages · <strong>{technical?.length??0}</strong> technical findings · <strong>{links?.length??0}</strong> link review items</p>
          {(!technical?.length&&!links?.length)&&<p>No findings in the limited observed sample. This does not prove the whole site is issue-free.</p>}
          {[...(technical??[]),...(links??[])].slice(0,50).map((f,i)=>
            <article key={i} style={{borderTop:'1px solid #d9e1db',padding:'12px 0',overflowWrap:'anywhere'}}>
              <strong>{(f.issue??'ISSUE').replace(/_/g,' ').toLowerCase()}</strong>
              <div style={{fontSize:12,color:'#6a796e'}}>{f.url??f.sourceUrl}{f.targetUrl?' → '+f.targetUrl:''}</div>
              <div style={{fontSize:11}}>{f.priority??f.severity??'Review'}</div>
            </article>)}
        </>}
        {mode==='pagespeed'&&speeds&&<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>
          {Object.entries(speeds).map(([key,value])=><div key={key} style={{background:'#f0f3ef',padding:13,borderRadius:12}}>
            <strong style={{fontSize:26}}>{value===null?'—':String(value)}</strong><p style={{fontSize:12,margin:0}}>{key}</p></div>)}
          <p style={{fontSize:12,gridColumn:'1 / -1'}}>Lighthouse lab measurements only; not field Core Web Vitals.</p>
        </div>}
        {mode==='gsc'&&<><p>{gsc?.length??0} observed query/page rows. Search Console can omit long-tail queries.</p>
          {(gsc??[]).slice(0,20).map((r,i)=><div key={i} style={{padding:'10px 0',borderTop:'1px solid #dae3dc'}}>
            <strong>{r.query}</strong><p style={{fontSize:12,margin:'4px 0'}}>{r.clicks} clicks · {r.impressions} impressions · avg. position {r.position.toFixed(1)}</p></div>)}
        </>}
      </section>}
    </div>
  </main>
}
