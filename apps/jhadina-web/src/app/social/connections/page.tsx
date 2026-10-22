"use client"

import { useEffect, useState } from "react"

type ProviderReadiness = {
  provider: string
  state: string
  registeredAccountCount: number
}
type Catalog = {
  aggregators: ProviderReadiness[]
  publicFeeds: Array<{id:string;label:string;state:string}>
  youtube: {state:string;connectPath:string|null;label:string;verifiedProfile:false}
  direct: Array<{id:string;label:string;state:string;details:string}>
  socialPublishingCommissioned: false
}
type FeedItem = {
  id:string;provider:string;title:string;url:string;publishedAt:string;
  summary:string;sourceId:string;provenance:string
}
type SourceState = { provider:string;identifier:string;state:string;itemCount:number }
type Preview = { items:FeedItem[];sources:SourceState[];persisted:false;authorizedToPublish:false }

const field = { border:"1px solid #cbd6cd",borderRadius:12,padding:"12px",font:"inherit",
  background:"#fff",color:"#253e32",maxWidth:"100%" }
const section = { background:"#fff",padding:18,borderRadius:20,marginTop:16,
  border:"1px solid #e4e9e1" }
const button = { border:"1px solid #d2d9d0",borderRadius:999,padding:"10px 15px",
  background:"#f5f8f4",color:"#253e32",fontWeight:600 as const,cursor:"pointer" }
const cap = { fontSize:12,color:"#627366",lineHeight:1.6 }

export default function SocialConnectionsPage(){
  const [catalog,setCatalog] = useState<Catalog|null>(null)
  const [message,setMessage] = useState("Checking your authenticated provider catalog…")
  const [provider,setProvider] = useState<"github"|"youtube"|"wordpress">("github")
  const [identifier,setIdentifier] = useState("")
  const [sources,setSources] = useState<string[]>([])
  const [preview,setPreview] = useState<Preview|null>(null)
  const [busy,setBusy] = useState(false)

  useEffect(()=>{
    let active = true
    void fetch("/api/social/connections/catalog",{cache:"no-store"}).then(async r=>{
      const result = await r.json()
      if(!r.ok) throw new Error(result.error||"Provider catalog unavailable")
      if(active){setCatalog(result.data);setMessage("Signed-in provider catalog loaded. No external account was connected.")}
    }).catch(e=>{if(active)setMessage(e instanceof Error?e.message:"Unavailable")})
    return()=>{active=false}
  },[])

  function addSource(){
    const value=provider+":"+identifier.trim()
    if(!identifier.trim()){setMessage("Enter a public source handle or YouTube channel ID.");return}
    if(sources.includes(value)){setMessage("That source is already in your preview.");return}
    if(sources.length>=4){setMessage("Preview is limited to four sources.");return}
    setSources(s=>[...s,value]);setIdentifier("");setPreview(null)
    setMessage("Source added to a temporary preview; no subscription was saved.")
  }

  async function fetchPreview(){
    if(!sources.length)return
    setBusy(true);setMessage("Reading public feeds only…")
    try{
      const params=new URLSearchParams()
      for(const source of sources)params.append("source",source)
      const r=await fetch("/api/social/feed/preview?"+params.toString(),{cache:"no-store"})
      const body=await r.json()
      if(!r.ok)throw new Error(body.error||"Public feed preview failed.")
      setPreview(body.data);setMessage("Public feed preview loaded. Posts are not private account data.")
    }catch(e){setPreview(null);setMessage(e instanceof Error?e.message:"Feed preview unavailable.")}
    finally{setBusy(false)}
  }

  return <main style={{minHeight:"100vh",background:"#f5f3ee",padding:"24px 14px 95px",fontFamily:"system-ui,sans-serif",color:"#243b2e"}}>
    <div style={{maxWidth:740,margin:"auto"}}>
      <a href="/social" style={{color:"#486f50",fontSize:13}}>← Social Command Center</a>
      <div style={{fontSize:11,letterSpacing:2,marginTop:22,color:"#657965"}}>JHADINA / PROVIDERS</div>
      <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(33px,8vw,48px)",fontWeight:400,margin:"8px 0"}}>Connect the feeds. Own the controls.</h1>
      <p style={{color:"#596b5e",lineHeight:1.65}}>
        SuperFeed-inspired reading brings authorized public sources together. Account authorization stays
        separate from content publishing, messages and spending.
      </p>
      <div role="status" style={{...cap,background:"#e8eee7",padding:12,borderRadius:12}}>{message}</div>

      <section style={section} aria-label="Public feed source connections">
        <h2 style={{fontSize:19,margin:"0 0 6px"}}>Add a public feed</h2>
        <p style={cap}>No API key required. Enter a GitHub username, a YouTube channel ID beginning with UC, or a WordPress.com site name. Other websites and URLs are not accepted.</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
          <select aria-label="Public feed provider" value={provider}
            onChange={e=>setProvider(e.target.value as typeof provider)} style={field}>
            <option value="github">GitHub</option><option value="youtube">YouTube</option><option value="wordpress">WordPress.com</option>
          </select>
          <input aria-label="Public feed identifier" value={identifier}
            onChange={e=>setIdentifier(e.target.value)}
            placeholder={provider==="github"?"GitHub username":provider==="youtube"?"UC… channel ID":"WordPress.com subdomain"}
            maxLength={90} style={{...field,flex:"1 1 200px"}}/>
          <button type="button" style={button} onClick={addSource} disabled={sources.length>=4}>Add</button>
        </div>
        {sources.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
          {sources.map(source=><button key={source} type="button" style={button}
            aria-label={"Remove "+source}
            onClick={()=>{setSources(s=>s.filter(x=>x!==source));setPreview(null)}}>{source} ×</button>)}
        </div>}
        <button type="button" style={{...button,marginTop:10,background:"#284637",color:"white"}}
          onClick={()=>void fetchPreview()} disabled={!sources.length||busy}>
          {busy?"Loading…":"Preview mixed feed"}
        </button>
        <p style={cap}>Previews are temporary, owner-session scoped and read-only. Automatic refresh and persistent subscriptions are not enabled.</p>
      </section>

      {preview&&<section style={section} aria-label="Mixed feed results">
        <h2 style={{fontSize:19,margin:0}}>Your mixed feed</h2>
        <p style={cap}>{preview.sources.map(s=>s.provider+": "+s.state+" ("+s.itemCount+")").join(" · ")}</p>
        <div style={{display:"grid",gap:10,marginTop:12}}>
          {preview.items.length?preview.items.map(item=><article key={item.id}
            style={{border:"1px solid #e2e9df",borderRadius:14,padding:13,background:"#fbfdf9"}}>
            <div style={{fontSize:11,color:"#607462"}}>{item.provider.toUpperCase()} · {new Date(item.publishedAt).toLocaleString()}</div>
            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{display:"block",fontWeight:650,margin:"6px 0",color:"#1f5b43"}}>{item.title}</a>
            <div style={cap}>{item.summary}</div>
          </article>):<p style={cap}>No posts returned. Check the source ID or try again later.</p>}
        </div>
      </section>}

      <section style={section} aria-label="OAuth account connections">
        <h2 style={{fontSize:19,margin:"0 0 6px"}}>Personal and business account connections</h2>
        <p style={cap}>OAuth grants require explicit provider consent. A feed preview never connects a private profile.</p>
        <div style={{display:"grid",gap:10,marginTop:12}}>
          {catalog?.youtube&&<div style={{borderTop:"1px solid #e4e9e1",paddingTop:12}}>
            <strong>YouTube / Google</strong>
            <div style={cap}>{catalog.youtube.state.replaceAll("_"," ")} · Read-only, not a Social publishing grant</div>
            {catalog.youtube.connectPath&&<a href={catalog.youtube.connectPath}
              style={{...button,display:"inline-block",textDecoration:"none",marginTop:9}}>
              Authorize YouTube read-only access ↗
            </a>}
          </div>}
          {catalog?.aggregators.map(p=><div key={p.provider} style={{borderTop:"1px solid #e4e9e1",paddingTop:12}}>
            <strong>{p.provider==="hootsuite"?"Hootsuite":"Ayrshare"}</strong>
            <div style={cap}>{p.state.replaceAll("_"," ")} · {p.registeredAccountCount} registered account(s), delivery unverified</div>
            <a href="/social" style={{fontSize:13,color:"#315a46"}}>Discover verified provider profiles →</a>
          </div>)}
          {catalog?.direct.map(p=><div key={p.id} style={{borderTop:"1px solid #e4e9e1",paddingTop:12}}>
            <strong>{p.label}</strong>
            <div style={cap}>{p.details} Connection not yet configured; no simulated login.</div>
          </div>)}
        </div>
      </section>
      <p style={{...cap,marginTop:18}}>Publishing, direct messages, subscriptions and payments remain disabled until separate permission and release checks pass.</p>
    </div>
  </main>
}
