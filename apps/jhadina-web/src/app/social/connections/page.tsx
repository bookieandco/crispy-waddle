"use client"

import Link from "next/link"
import {useEffect,useState} from "react"

type YouTubeState={connected:boolean;configured?:boolean;reason?:string}
type SocialAccount={id:string;platform:string;displayName:string;status:string}
type Health="checking"|"unavailable"|"ready"
type PublicCandidate={externalId:string;title:string;summary:string;url:string;sourceAccount:string}
const sourcePlan=[
 {name:"Facebook Pages + Instagram Professional",lane:"Meta business and creator media",need:"Meta app approval, exact Page and Professional account permissions. Not a personal friends/following feed."},
 {name:"TikTok",lane:"Authorized creator videos",need:"TikTok Login Kit + video.list approval. Not the For You feed."},
 {name:"Reddit",lane:"Approved communities and subscribed posts",need:"2026 Reddit developer approval, rate limits and permitted purpose. No bypass scraping."},
 {name:"Bluesky",lane:"Public author posts · preview available",need:"You can preview a public author above. Following-list sync and account OAuth are not commissioned."},
 {name:"Mastodon",lane:"Mastodon.social public author posts · preview available",need:"You can preview public posts above. A private home timeline or additional instances require separate approval."},
 {name:"X, LinkedIn, Snapchat and others",lane:"Approved account and business data",need:"Separate API and account eligibility review; no assumed universal home-feed access."},
] as const

export default function FeedConnectionsPage(){
 const [youtube,setYouTube]=useState<YouTubeState|null>(null)
 const [social,setSocial]=useState<SocialAccount[]>([])
 const [youtubeHealth,setYoutubeHealth]=useState<Health>("checking")
 const [disconnecting,setDisconnecting]=useState(false)
 const [disconnectError,setDisconnectError]=useState("")
 const [socialHealth,setSocialHealth]=useState<Health>("checking")
 const [publicProvider,setPublicProvider]=useState<"bluesky"|"mastodon">("bluesky")
 const [publicActor,setPublicActor]=useState("")
 const [publicItems,setPublicItems]=useState<PublicCandidate[]>([])
 const [publicBusy,setPublicBusy]=useState(false)
 const [publicMessage,setPublicMessage]=useState("")
 useEffect(()=>{
  let mounted=true
  void fetch("/api/music/youtube/status",{credentials:"same-origin",cache:"no-store"}).then(async r=>{
   if(!r.ok)throw new Error("Unavailable")
   return r.json() as Promise<YouTubeState>
  }).then(x=>{if(mounted){setYouTube(x);setYoutubeHealth("ready")}}).catch(()=>{if(mounted)setYoutubeHealth("unavailable")})
  void fetch("/api/social/profiles",{credentials:"same-origin",cache:"no-store"}).then(async r=>{
   const x=await r.json() as {success:boolean;data?:SocialAccount[]}
   if(!r.ok||!x.success)throw new Error("Unavailable")
   return x.data??[]
  }).then(x=>{if(mounted){setSocial(x);setSocialHealth("ready")}}).catch(()=>{if(mounted)setSocialHealth("unavailable")})
  return()=>{mounted=false}
 },[])
 async function disconnectYoutube(){
  setDisconnecting(true);setDisconnectError("")
  try{
   const response=await fetch("/api/auth/youtube/disconnect",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:"{}"})
   if(!response.ok)throw new Error("Could not disconnect. Please try again.")
   setYouTube({connected:false});setYoutubeHealth("ready")
  }catch(error){setDisconnectError(error instanceof Error?error.message:"Disconnect failed")}
  finally{setDisconnecting(false)}
 }
 async function previewPublicSource(){
   if(!publicActor.trim())return
   setPublicBusy(true);setPublicMessage("");setPublicItems([])
   try{
     const params=new URLSearchParams({provider:publicProvider,account:publicActor.trim()})
     const response=await fetch("/api/home/public-social?"+params.toString(),{cache:"no-store",credentials:"same-origin"})
     const data=await response.json() as {ok:boolean;items?:PublicCandidate[];error?:string}
     if(!response.ok||!data.ok)throw Error("This public source is unavailable or restricted.")
     setPublicItems(data.items??[])
     if(!data.items?.length)setPublicMessage("No public posts returned. This does not mean a private feed is connected.")
   }catch(error){setPublicMessage(error instanceof Error?error.message:"Source unavailable")}
   finally{setPublicBusy(false)}
 }
 const registered=social.filter(x=>x.status==="connected")
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Jhadina · Feed connections</p>
  <h1 className="jh-title">Your sources, your call.</h1>
  <p className="jh-copy">Choose which services Jhadina can read. A publishing account is not automatically a personal social feed. Each provider needs its own permission and a verifiable source. Read access never approves posting, spending or memory updates.</p>
  <div className="jh-grid">
   <section className="jh-card jh-card--third">
    <h2 className="jh-card-title">YouTube</h2>
    <p className="jh-card-copy">Subscribed-channel uploads through your own Google consent. The Home preview uses real API responses, but it cannot copy the YouTube recommendation algorithm.</p>
    <p className="jh-meta" role="status">{youtubeHealth==="checking"?"Checking local authorization…":youtubeHealth==="unavailable"?"Connection status unavailable":youtube?.configured===false?"Google OAuth setup required in this deployment":youtube?.connected?"Authorization cookie present · validate latest uploads on Home":"Not connected for this Jhadina owner"}</p>
    <div className="jh-row" style={{marginTop:14}}>{youtubeHealth==="ready"&&youtube?.configured===false?<span className="jh-status jh-status--warning">Operator setup required</span>:<a href="/api/auth/youtube/start" className="jh-button jh-button--primary">{youtube?.connected?"Reconnect YouTube":"Connect YouTube"}</a>}<Link href="/#jhadina-feed" className="jh-button">See feed</Link>{youtube?.connected?<button type="button" className="jh-button" disabled={disconnecting} onClick={()=>void disconnectYoutube()}>{disconnecting?"Disconnecting…":"Disconnect on this device"}</button>:null}</div>
    {disconnectError?<p className="jh-error" role="alert">{disconnectError}</p>:null}
    {youtube?.connected?<p className="jh-meta">Local disconnect removes this browser’s YouTube cookies. Google’s account-level app permission is managed separately.</p>:null}
   </section>
   <section className="jh-card jh-card--third">
    <h2 className="jh-card-title">Social publisher accounts</h2>
    <p className="jh-card-copy">Jhadina&apos;s existing Social Core manages owned brand profiles, publication proposals and observations. This is different from importing a personal timeline.</p>
    <p className="jh-meta" role="status">{socialHealth==="checking"?"Checking account registry…":socialHealth==="unavailable"?"Account registry unavailable":registered.length+" registered connected-status profiles · provider access not independently reverified"}</p>
    <div className="jh-row" style={{marginTop:14}}><Link href="/social" className="jh-button jh-button--primary">Manage accounts</Link></div>
   </section>
   <section className="jh-card jh-card--third">
    <h2 className="jh-card-title">Facebook personality import</h2>
    <p className="jh-card-copy">An owner-exported Facebook archive can inform proposed personality or taste observations after review. It is not the same thing as a live Facebook Home feed, and it cannot silently become durable memory.</p>
    <div className="jh-row" style={{marginTop:14}}><Link href="/memory" className="jh-button">Review memory</Link><Link href="/settings/privacy" className="jh-button">Privacy</Link></div>
   </section>
  </div>
  <section className="jh-section">
   <h2 className="jh-section-title">Explore public sources</h2>
   <p className="jh-card-copy">Read genuine public posts from a specified Bluesky or Mastodon account. This is a one-time preview, not a connected personal timeline or a saved subscription.</p>
   <div className="jh-row" style={{gap:8,flexWrap:"wrap",alignItems:"center",marginTop:12}}>
    <label className="jh-meta" htmlFor="public-source-provider">Network</label>
    <select id="public-source-provider" value={publicProvider} onChange={event=>{setPublicProvider(event.target.value as "bluesky"|"mastodon");setPublicItems([]);setPublicMessage("")}} className="jh-input">
     <option value="bluesky">Bluesky</option><option value="mastodon">Mastodon.social</option>
    </select>
    <label className="jh-meta" htmlFor="public-source-handle">Public handle</label>
    <input id="public-source-handle" className="jh-input" value={publicActor} placeholder={publicProvider==="bluesky"?"example.bsky.social":"example"} maxLength={250} onChange={event=>setPublicActor(event.target.value)}/>
    <button type="button" className="jh-button jh-button--primary" disabled={!publicActor.trim()||publicBusy} onClick={()=>void previewPublicSource()}>{publicBusy?"Checking…":"Preview public posts"}</button>
   </div>
   {publicMessage?<p className="jh-meta" role="status">{publicMessage}</p>:null}
   <div className="jh-grid" style={{marginTop:15}}>
    {publicItems.map(post=><article key={post.externalId} className="jh-card jh-card--third">
     <h3 className="jh-card-title">{post.title}</h3>
     <p className="jh-card-copy">{post.summary}</p>
     <p className="jh-meta">Public source: {post.sourceAccount} · not imported into memory</p>
     <a className="jh-button" href={post.url} target="_blank" rel="noopener noreferrer">View original</a>
    </article>)}
   </div>
  </section>
  <section className="jh-section">
   <h2 className="jh-section-title">Next approved read sources</h2>
   <p className="jh-card-copy">The public author preview above is active in code; all other listed services remain connection plans. No provider sign-in is enabled without an approved app and scopes.</p>
   <div className="jh-grid">
    {sourcePlan.map(item=><article key={item.name} className="jh-card jh-card--third">
      <h3 className="jh-card-title">{item.name}</h3>
      <p className="jh-card-copy"><strong>{item.lane}</strong></p>
      <p className="jh-card-copy">{item.need}</p>
      <p className="jh-meta">{item.name==="Bluesky"||item.name==="Mastodon"?"Public preview only · not connected":"Not commissioned"}</p>
    </article>)}
   </div>
  </section>
 </div></main>
}
