'use client'

import { useEffect, useState } from 'react'

type Site={ventureId:string;website:string;gscConfigured:boolean;gscSessionAuthorized:boolean}
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
  const [gscStatus,setGscStatus]=useState('')
  const [connecting,setConnecting]=useState(false)
  const [report,setReport]=useState<Report|null>(null)
  const [history,setHistory]=useState<Array<{date:string;technicalFindings:number|null;linkReviewItems:number|null;observedCountChange:number|null}>>([])
  const [fixUrl,setFixUrl]=useState('')
  const [fixField,setFixField]=useState<'title'|'description'>('description')
  const [fixAfter,setFixAfter]=useState('')
  const [fixPreview,setFixPreview]=useState<{before:string;after:string;state:string}|null>(null)
  const [fixBusy,setFixBusy]=useState(false)
  useEffect(()=>{
    setGscStatus(new URLSearchParams(window.location.search).get('gsc')??'')
    let open=true
    fetch('/api/growth/seo',{cache:'no-store'}).then(async r=>{
      const v=await r.json()
      if(!r.ok)throw new Error(v.error||'Unable to load owned sites')
      if(open){setSites(v.sites??[]);setSiteId(v.sites?.[0]?.ventureId??'')}
    }).catch(e=>{if(open)setError(String(e instanceof Error?e.message:e))})
    return ()=>{open=false}
  },[])
  async function connectGsc(){
    if(!siteId||connecting)return
    setConnecting(true);setError('')
    try{
      const response=await fetch('/api/growth/seo/oauth/start',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({ventureId:siteId}),
      })
      const data=await response.json()
      if(!response.ok||!data.ok||typeof data.authorizationUrl!=='string')
        throw new Error(data.error||'Google consent is unavailable')
      // Redirect only to Google's fixed OAuth endpoint returned by our server.
      const target=new URL(data.authorizationUrl)
      if(target.origin!=='https://accounts.google.com' ||
        target.pathname!=='/o/oauth2/v2/auth')throw new Error('Unexpected Google consent URL')
      window.location.assign(target.toString())
    }catch(e){setError(e instanceof Error?e.message:'Google consent unavailable');setConnecting(false)}
  }
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
  useEffect(()=>{
    let open=true
    if(!siteId){setHistory([]);return}
    fetch('/api/growth/seo/history?ventureId='+encodeURIComponent(siteId),{cache:'no-store'})
      .then(r=>r.json()).then(v=>{if(open)setHistory(v.ok?(v.entries??[]):[])})
      .catch(()=>{if(open)setHistory([])})
    return ()=>{open=false}
  },[siteId])
  async function prepareFix(){
    if(!siteId||!fixUrl.trim()||!fixAfter.trim()||fixBusy)return
    setFixBusy(true);setFixPreview(null);setError('')
    try{
      const response=await fetch('/api/growth/seo/fix-preview',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({ventureId:siteId,pageUrl:fixUrl,field:fixField,after:fixAfter}),
      })
      const result=await response.json()
      if(!response.ok||!result.ok)throw new Error(result.error||'Preview unavailable')
      setFixPreview(result.proposal)
    }catch(e){setError(e instanceof Error?e.message:'Preview unavailable')}
    finally{setFixBusy(false)}
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
        {mode==='gsc'&&<>
          {!site?.gscConfigured&&<p style={{fontSize:13}}>A verified Search Console property must be registered for this site first.</p>}
          {site?.gscConfigured&&<div style={{fontSize:13,padding:'12px 0'}}>
            <p>{site.gscSessionAuthorized?'Read-only Google session saved on this device.':'Google Search Console needs your explicit read-only authorization.'}</p>
            <button type="button" disabled={connecting} onClick={connectGsc} style={secondary}>
              {connecting?'Opening Google…':site.gscSessionAuthorized?'Reconnect Google':'Connect Google Search Console'}
            </button>
          </div>}
        </>}
        {gscStatus==='connected'&&<p role="status" style={{fontSize:13,color:'#2d7046'}}>Google confirmed read-only property access. Select Google search and run a check.</p>}
        {['denied','error'].includes(gscStatus)&&<p role="alert" style={{fontSize:13,color:'#9b443e'}}>Google authorization was not completed. No Search Console connection was saved.</p>}
        <div style={{marginTop:17}}>
          <button disabled={busy||!siteId||(mode==='gsc'&&!site?.gscConfigured)}
            style={{...action,opacity:busy||!siteId?0.6:1}} onClick={scan}>
            {busy?'Reading source evidence…':'Run read-only check'}
          </button>
        </div>
        {!sites.length&&<p style={{fontSize:13,color:'#8a554d'}}>Configuration needed: register an owned venture and HTTPS site in private runtime settings.</p>}
      </section>
      {error&&<p role="alert" style={{color:'#9b443e',padding:12}}>{error}</p>}
      <section style={panel}>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:400,marginTop:0}}>Prepare an SEO fix</h2>
        <p style={{fontSize:13,color:'#65756d'}}>For observed owned pages only. Jhadina rechecks the actual page before preparing a proposal. This does not edit or publish anything.</p>
        <label style={{fontSize:13}}>Exact page URL
          <input type="url" value={fixUrl} onChange={e=>setFixUrl(e.target.value)}
            placeholder="https://your-site.example/page" style={{display:'block',width:'100%',padding:11,margin:'7px 0 13px',borderRadius:10,border:'1px solid #cedbd1'}}/>
        </label>
        <label style={{fontSize:13}}>Field&nbsp;
          <select value={fixField} onChange={e=>setFixField(e.target.value as 'title'|'description')} style={{padding:8,borderRadius:10}}>
            <option value="description">Meta description</option><option value="title">Page title</option>
          </select>
        </label>
        <textarea value={fixAfter} onChange={e=>setFixAfter(e.target.value)} placeholder="Suggested replacement text"
          rows={3} maxLength={170} style={{display:'block',width:'100%',padding:11,borderRadius:10,margin:'13px 0',border:'1px solid #cedbd1'}}/>
        <button onClick={prepareFix} style={secondary} disabled={fixBusy||!siteId}>{fixBusy?'Reviewing source…':'Prepare preview'}</button>
        {fixPreview&&<div style={{padding:14,background:'#e9eee9',borderRadius:12,marginTop:14}}>
          <strong>Not published — approval required</strong>
          <p style={{fontSize:12}}>Before: {fixPreview.before||'(empty)'}</p>
          <p style={{fontSize:12}}>Proposed: {fixPreview.after}</p>
          <p style={{fontSize:11}}>This preview does not itself authorize a CMS write.</p>
        </div>}
      </section>
      {history.length>0&&<section style={panel}>
        <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:24,marginTop:0}}>Weekly observations</h2>
        <p style={{fontSize:12,color:'#64786a'}}>Finding counts from partial site samples. Changes in coverage can affect counts.</p>
        {history.slice(0,8).map((h,i)=><div key={i} style={{borderTop:'1px solid #dae1db',padding:'10px 0'}}>
          <strong>{h.date}</strong>
          <span style={{display:'block',fontSize:12}}>Technical: {h.technicalFindings??'—'} · Links: {h.linkReviewItems??'—'} · Observed change: {h.observedCountChange??'—'}</span>
        </div>)}
      </section>}
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
