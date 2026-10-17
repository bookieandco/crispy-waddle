"use client"

import Link from "next/link"
import {useEffect,useState} from "react"

type YouTubeState={connected:boolean;reason?:string}
type SocialAccount={id:string;platform:string;displayName:string;status:string}
type Health="checking"|"unavailable"|"ready"
const sourcePlan=[
 {name:"Facebook Pages + Instagram Professional",lane:"Meta business and creator media",need:"Meta app approval, exact Page and Professional account permissions. Not a personal friends/following feed."},
 {name:"TikTok",lane:"Authorized creator videos",need:"TikTok Login Kit + video.list approval. Not the For You feed."},
 {name:"Reddit",lane:"Approved communities and subscribed posts",need:"2026 Reddit developer approval, rate limits and permitted purpose. No bypass scraping."},
 {name:"Bluesky",lane:"Public sources and authorized timeline",need:"Next free-first candidate: AT Protocol read adapter and owner account consent."},
 {name:"Mastodon",lane:"Public posts and authorized following timeline",need:"Next free-first candidate: instance-bound OAuth with read:statuses."},
 {name:"X, LinkedIn, Snapchat and others",lane:"Approved account and business data",need:"Separate API and account eligibility review; no assumed universal home-feed access."},
] as const

export default function FeedConnectionsPage(){
 const [youtube,setYouTube]=useState<YouTubeState|null>(null)
 const [social,setSocial]=useState<SocialAccount[]>([])
 const [youtubeHealth,setYoutubeHealth]=useState<Health>("checking")
 const [socialHealth,setSocialHealth]=useState<Health>("checking")
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
 const registered=social.filter(x=>x.status==="connected")
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Jhadina · Feed connections</p>
  <h1 className="jh-title">Your sources, your call.</h1>
  <p className="jh-copy">Choose which services Jhadina can read. A publishing account is not automatically a personal social feed. Each provider needs its own permission and a verifiable source. Read access never approves posting, spending or memory updates.</p>
  <div className="jh-grid">
   <section className="jh-card jh-card--third">
    <h2 className="jh-card-title">YouTube</h2>
    <p className="jh-card-copy">Subscribed-channel uploads through your own Google consent. The Home preview uses real API responses, but it cannot copy the YouTube recommendation algorithm.</p>
    <p className="jh-meta" role="status">{youtubeHealth==="checking"?"Checking local authorization…":youtubeHealth==="unavailable"?"Connection status unavailable":youtube?.connected?"Authorization cookie present · validate latest uploads on Home":"Not connected for this Jhadina owner"}</p>
    <div className="jh-row" style={{marginTop:14}}><a href="/api/auth/youtube/start" className="jh-button jh-button--primary">{youtube?.connected?"Reconnect YouTube":"Connect YouTube"}</a><Link href="/#jhadina-feed" className="jh-button">See feed</Link></div>
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
   <h2 className="jh-section-title">Next approved read sources</h2>
   <p className="jh-card-copy">These are connection plans, not active integrations. No sign-in control appears until an app, scopes and API handler have been reviewed.</p>
   <div className="jh-grid">
    {sourcePlan.map(item=><article key={item.name} className="jh-card jh-card--third">
      <h3 className="jh-card-title">{item.name}</h3>
      <p className="jh-card-copy"><strong>{item.lane}</strong></p>
      <p className="jh-card-copy">{item.need}</p>
      <p className="jh-meta">Not commissioned</p>
    </article>)}
   </div>
  </section>
 </div></main>
}
