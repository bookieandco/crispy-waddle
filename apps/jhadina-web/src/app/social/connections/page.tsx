"use client"

import Link from "next/link"
import {useEffect,useState} from "react"
import {SOCIAL_FEED_TARGETS,feedReadiness} from "@/lib/social/feed-provider-setup"
import type {SelectedSocialProfile} from "@/lib/social/requested-account-contract"

type YouTubeState={connected:boolean;configured?:boolean;reason?:string}
type SocialAccount={id:string;platform:string;displayName:string;status:string}
type Health="checking"|"unavailable"|"ready"
type PublicCandidate={externalId:string;title:string;summary:string;url:string;sourceAccount:string}
type SavedPublicSource={provider:"bluesky"|"mastodon"|"github";handle:string;state:string;lastVerifiedAt?:string}
export default function FeedConnectionsPage(){
 const [youtube,setYouTube]=useState<YouTubeState|null>(null)
 const [selectedProfiles,setSelectedProfiles]=useState<SelectedSocialProfile[]>([])
 const [selectedStatus,setSelectedStatus]=useState<"checking"|"ready"|"signin"|"unavailable">("checking")
 const [social,setSocial]=useState<SocialAccount[]>([])
 const [youtubeHealth,setYoutubeHealth]=useState<Health>("checking")
 const [disconnecting,setDisconnecting]=useState(false)
 const [disconnectError,setDisconnectError]=useState("")
 const [socialHealth,setSocialHealth]=useState<Health>("checking")
 const [publicProvider,setPublicProvider]=useState<"bluesky"|"mastodon"|"github">("bluesky")
 const [publicActor,setPublicActor]=useState("")
 const [publicItems,setPublicItems]=useState<PublicCandidate[]>([])
 const [publicBusy,setPublicBusy]=useState(false)
 const [publicMessage,setPublicMessage]=useState("")
 const [savedSources,setSavedSources]=useState<SavedPublicSource[]>([])
 const [savedStatus,setSavedStatus]=useState<"checking"|"ready"|"disabled"|"unavailable">("checking")
 const [saveBusy,setSaveBusy]=useState(false)
 const [savedNotice,setSavedNotice]=useState("")
 useEffect(()=>{
  let mounted=true
  void fetch("/api/social/requested-accounts",{credentials:"same-origin",cache:"no-store"}).then(async response=>{
   if(response.status===401){if(mounted)setSelectedStatus("signin");return}
   if(!response.ok)throw Error("Unable to load selected social profiles")
   const data=await response.json() as {ok:boolean;profiles?:SelectedSocialProfile[]}
   if(!data.ok)throw Error("Selected profiles unavailable")
   if(mounted){setSelectedProfiles(data.profiles??[]);setSelectedStatus("ready")}
  }).catch(()=>{if(mounted)setSelectedStatus("unavailable")})
  void fetch("/api/music/youtube/status",{credentials:"same-origin",cache:"no-store"}).then(async r=>{
   if(!r.ok)throw new Error("Unavailable")
   return r.json() as Promise<YouTubeState>
  }).then(x=>{if(mounted){setYouTube(x);setYoutubeHealth("ready")}}).catch(()=>{if(mounted)setYoutubeHealth("unavailable")})
  void fetch("/api/social/profiles",{credentials:"same-origin",cache:"no-store"}).then(async r=>{
   const x=await r.json() as {success:boolean;data?:SocialAccount[]}
   if(!r.ok||!x.success)throw new Error("Unavailable")
   return x.data??[]
  }).then(x=>{if(mounted){setSocial(x);setSocialHealth("ready")}}).catch(()=>{if(mounted)setSocialHealth("unavailable")})
  void fetch("/api/social/feed-connections",{credentials:"same-origin",cache:"no-store"}).then(async r=>{
   if(r.status===503){if(mounted)setSavedStatus("disabled");return}
   if(!r.ok)throw Error("Saved accounts unavailable")
   const response=await r.json() as {ok:boolean;sources?:SavedPublicSource[]}
   if(!response.ok)throw Error("Unable to verify saved public sources")
   if(mounted){setSavedSources(response.sources??[]);setSavedStatus("ready")}
  }).catch(()=>{if(mounted)setSavedStatus("unavailable")})
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
 async function changePublicSource(method:"POST"|"DELETE",account:SavedPublicSource|{provider:"bluesky"|"mastodon"|"github";handle:string}){
  setSaveBusy(true);setSavedNotice("")
  try{
   const response=await fetch("/api/social/feed-connections",{
    method,credentials:"same-origin",headers:{"content-type":"application/json"},
    body:JSON.stringify({provider:account.provider,handle:account.handle}),
   })
   const data=await response.json() as {ok?:boolean;error?:string}
   if(!response.ok||data.ok!==true)throw Error(data.error==="FEED_STORAGE_NOT_ENABLED"
    ?"Saved-source storage is not activated on this private deployment."
    :method==="POST"?"Public source could not be verified or saved.":"Public source could not be removed.")
   if(method==="POST"){
    setSavedSources(old=>old.some(s=>s.provider===account.provider&&s.handle===account.handle)
      ?old:[...old,{...account,state:"healthy"}])
   }else{
    setSavedSources(old=>old.filter(s=>s.provider!==account.provider||s.handle!==account.handle))
   }
   setSavedNotice(method==="POST"?"Public source saved. No private account was connected.":"Public source removed.")
  }catch(error){setSavedNotice(error instanceof Error?error.message:"Source update failed")}
  finally{setSaveBusy(false)}
 }
 const registered=social.filter(x=>x.status==="connected")
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Jhadina · Feed connections</p>
  <h1 className="jh-title">Your sources, your call.</h1>
  <p className="jh-copy">Choose which services Jhadina can read. A publishing account is not automatically a personal social feed. Each provider needs its own permission and a verifiable source. Read access never approves posting, spending or memory updates.</p>
  <section className="jh-section" aria-labelledby="jh-selected-social-heading">
   <h2 id="jh-selected-social-heading" className="jh-section-title">Your selected accounts</h2>
   <p className="jh-card-copy">These are the profile links you provided for Jhadina. They're saved to your private account as pending connection requests. Profile links do not grant access to private feeds, conversations or account publishing.</p>
   {selectedStatus==="checking"?<p className="jh-meta" role="status">Checking your saved profiles…</p>:null}
   {selectedStatus==="signin"?<p className="jh-meta" role="status">Sign in to Jhadina to see your selected accounts.</p>:null}
   {selectedStatus==="unavailable"?<p className="jh-meta" role="status">Selected profiles couldn't be verified right now; no accounts are shown as connected.</p>:null}
   {selectedStatus==="ready"&&selectedProfiles.length===0?<p className="jh-meta" role="status">No selected accounts are saved for this signed-in user.</p>:null}
   {selectedStatus==="ready"&&selectedProfiles.length>0?<div className="jh-grid" style={{marginTop:14}}>
    {selectedProfiles.map(profile=>{
     const definition=SOCIAL_FEED_TARGETS.find(item=>item.id===profile.provider)
     return <article key={profile.provider+":"+profile.handle} className="jh-card jh-card--third">
      <h3 className="jh-card-title">{definition?.label??profile.provider} · @{profile.handle}</h3>
      <p className="jh-meta" role="status">Authorization required · not connected</p>
      <p className="jh-card-copy">{definition?.canRead??"Provider permission required"}</p>
      <p className="jh-meta">{definition?.limitation??"Provider may restrict private feeds."}</p>
      <div className="jh-row" style={{marginTop:12}}>
       <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer" className="jh-button">Open your profile</a>
       <a href="#jh-provider-readiness" className="jh-button">Connection requirements</a>
      </div>
     </article>
    })}
   </div>:null}
  </section>
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
   <p className="jh-card-copy">Read genuine public posts from Bluesky/Mastodon, or public GitHub user activity, with no account authorization. This is a one-time preview, not a connected personal timeline or a saved subscription.</p>
   <div className="jh-row" style={{gap:8,flexWrap:"wrap",alignItems:"center",marginTop:12}}>
    <label className="jh-meta" htmlFor="public-source-provider">Network</label>
    <select id="public-source-provider" value={publicProvider} onChange={event=>{setPublicProvider(event.target.value as "bluesky"|"mastodon"|"github");setPublicItems([]);setPublicMessage("")}} className="jh-input">
     <option value="bluesky">Bluesky</option><option value="mastodon">Mastodon.social</option><option value="github">GitHub public</option>
    </select>
    <label className="jh-meta" htmlFor="public-source-handle">Public handle</label>
    <input id="public-source-handle" className="jh-input" value={publicActor} placeholder={publicProvider==="bluesky"?"example.bsky.social":publicProvider==="github"?"GitHub username":"example"} maxLength={250} onChange={event=>setPublicActor(event.target.value)}/>
    <button type="button" className="jh-button jh-button--primary" disabled={!publicActor.trim()||publicBusy} onClick={()=>void previewPublicSource()}>{publicBusy?"Checking…":"Preview public posts"}</button>
    {publicItems.length>0?<button type="button" className="jh-button" disabled={saveBusy||savedStatus!=="ready"} onClick={()=>void changePublicSource("POST",{provider:publicProvider,handle:publicActor.trim().replace(/^@/,"")})}>{saveBusy?"Saving…":"Save public source to Home"}</button>:null}
   </div>
   {publicMessage?<p className="jh-meta" role="status">{publicMessage}</p>:null}
   <p className="jh-meta" role="status">{savedStatus==="checking"?"Checking saved-source access…":savedStatus==="disabled"?"Saving is not commissioned on this deployment; public preview still works.":savedStatus==="unavailable"?"Saved source list unavailable.":savedSources.length+" public sources saved for on-demand Home reading."}</p>
   {savedNotice?<p className="jh-meta" role="status">{savedNotice}</p>:null}
   {savedSources.length>0?<div className="jh-grid" style={{marginTop:10}}>
    {savedSources.map(saved=><article key={saved.provider+":"+saved.handle} className="jh-card jh-card--third">
     <p className="jh-card-title">{saved.provider}: @{saved.handle}</p>
     <p className="jh-meta">Saved public source · no private-account grant</p>
     <button type="button" className="jh-button" disabled={saveBusy} onClick={()=>void changePublicSource("DELETE",saved)}>Remove source</button>
    </article>)}
   </div>:null}
   <div className="jh-grid" style={{marginTop:15}}>
    {publicItems.map(post=><article key={post.externalId} className="jh-card jh-card--third">
     <h3 className="jh-card-title">{post.title}</h3>
     <p className="jh-card-copy">{post.summary}</p>
     <p className="jh-meta">Public source: {post.sourceAccount} · not imported into memory</p>
     <a className="jh-button" href={post.url} target="_blank" rel="noopener noreferrer">View original</a>
    </article>)}
   </div>
  </section>
  <section className="jh-section" id="jh-provider-readiness">
   <h2 className="jh-section-title">Account-by-account connection readiness</h2>
   <p className="jh-card-copy">Showing supported and planned platforms, not claiming your personal accounts are connected. Each account requires separate consent and proof of a successful read. Read-only source access cannot publish or authorize Jhadina memory changes.</p>
   <div className="jh-grid">
    {SOCIAL_FEED_TARGETS.map(item=>{
     const readiness=feedReadiness(item,{
      youtubeConnected:youtubeHealth==="ready"&&youtube?.connected===true,
      youtubeConfigured:youtubeHealth==="ready"?youtube?.configured:undefined,
      youtubeStatusUnavailable:youtubeHealth==="unavailable",
      registryUnavailable:socialHealth==="unavailable",
      registeredProfiles:social,
     })
     return <article key={item.id} className="jh-card jh-card--third">
      <h3 className="jh-card-title">{item.label}</h3>
      <p className="jh-meta" role="status">{readiness.label}</p>
      <p className="jh-card-copy"><strong>What Jhadina can read:</strong> {item.canRead}</p>
      <p className="jh-card-copy">{item.limitation}</p>
      <p className="jh-meta">{readiness.details}</p>
      {item.setup==="youtube_oauth"&&youtubeHealth==="ready"&&youtube?.configured!==false&&!youtube?.connected
       ?<a className="jh-button" href="/api/auth/youtube/start">Authorize YouTube</a>:null}
      {item.setup==="social_registry"?<Link className="jh-button" href="/social">View Social accounts</Link>:null}
      {item.setup==="public_preview"?<a className="jh-button" href="#public-source-provider">Preview public author</a>:null}
     </article>
    })}
   </div>
  </section>
 </div></main>
}
