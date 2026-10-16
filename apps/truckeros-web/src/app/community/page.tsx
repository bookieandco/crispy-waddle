"use client"

import Link from "next/link"
import {useCallback,useEffect,useState,type FormEvent} from "react"

type Actor={id:string;handle:string;displayName:string;bio:string;region:string|null;socialEnabled:boolean;discoverable:boolean;crewUpEnabled:boolean}
type Post={id:string;handle:string;authorId:string;displayName:string;body:string;audience:"friends"|"network";kind:"update"|"review"|"recommendation";placeId:string|null;rating:number|null;createdAt:string}
type Comment={id:string;handle:string;body:string;parentId:string|null}
type Count={likeCount:number;commentCount:number;likedByMe:boolean;bookmarkedByMe:boolean}
type State={actor:Actor;feed:Post[];friends:Actor[];incoming:Actor[];discoverable:Actor[]}
async function send<T>(payload:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/community",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"})
 const json=await r.json() as {success:boolean;data?:T;error?:string}
 if(!r.ok||!json.success||!json.data)throw Error(json.error??"Request failed")
 return json.data
}
function monogram(name:string){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()??"").join("")}

export default function CommunityPage(){
 const [stage,setStage]=useState<"loading"|"guest"|"locked"|"member">("loading")
 const [state,setState]=useState<State|null>(null)
 const [tab,setTab]=useState<"feed"|"drivers"|"profile">("feed")
 const [register,setRegister]=useState(false)
 const [email,setEmail]=useState("")
 const [password,setPassword]=useState("")
 const [handle,setHandle]=useState("")
 const [name,setName]=useState("")
 const [bio,setBio]=useState("")
 const [region,setRegion]=useState("")
 const [body,setBody]=useState("")
 const [audience,setAudience]=useState<"friends"|"network">("friends")
 const [notice,setNotice]=useState("")
 const [busy,setBusy]=useState(false)
 const [expanded,setExpanded]=useState<string|null>(null)
 const [commentBody,setCommentBody]=useState("")
 const [comments,setComments]=useState<Comment[]>([])
 const [counts,setCounts]=useState<Record<string,Count>>({})

 const reload=useCallback(async()=>{
   const r=await fetch("/api/community",{cache:"no-store",credentials:"same-origin"})
   if(r.status===503){setStage("locked");setState(null);return}
   if(r.status===401){setStage("guest");setState(null);return}
   const j=await r.json() as {success:boolean;data?:State}
   if(!r.ok||!j.success||!j.data)throw Error("Cannot load the driver community")
   setState(j.data);setName(j.data.actor.displayName);setBio(j.data.actor.bio);setRegion(j.data.actor.region??"");setStage("member")
 },[])
 useEffect(()=>{void reload().catch(()=>{setNotice("Network unavailable");setStage("guest")})},[reload])
 async function act(payload:Record<string,unknown>,success?:string):Promise<boolean>{
   setBusy(true);setNotice("")
   try{await send<unknown>(payload);if(success)setNotice(success);await reload();return true}
   catch(e){setNotice(e instanceof Error?e.message:"Request failed");return false}
   finally{setBusy(false)}
 }
 async function auth(e:FormEvent<HTMLFormElement>){
   e.preventDefault()
   const ok=await act({action:register?"register":"login",email,password,handle,displayName:name})
   if(ok){setPassword("");setTab("feed")}
 }
 async function publish(e:FormEvent<HTMLFormElement>){
   e.preventDefault()
   if(await act({action:"post",body,audience,kind:"update"},"Your post is live for the selected audience."))setBody("")
 }
 async function expand(postId:string){
   if(expanded===postId){setExpanded(null);return}
   try{
     const v=await send<{comments:Comment[];engagement:Count}>({action:"comments",postId})
     setExpanded(postId);setComments(v.comments);setCounts(old=>({...old,[postId]:v.engagement}))
   }catch{setNotice("Unable to load comments")}
 }
 async function react(postId:string,kind:"like"|"bookmark"){
   try{
     const current=counts[postId]??(await send<{engagement:Count}>({action:"comments",postId})).engagement
     const next=kind==="like"?!current.likedByMe:!current.bookmarkedByMe
     const out=await send<{engagement:Count}>({action:kind,postId,...(kind==="like"?{liked:next}:{saved:next})})
     setCounts(old=>({...old,[postId]:out.engagement}))
   }catch{setNotice("Unable to update post")}
 }
 async function reply(e:FormEvent<HTMLFormElement>){
   e.preventDefault()
   if(!expanded)return
   const postId=expanded
   if(await act({action:"comment",postId,body:commentBody},"Comment added")){
     setCommentBody("")
     try{
       const v=await send<{comments:Comment[];engagement:Count}>({action:"comments",postId})
       setComments(v.comments);setCounts(old=>({...old,[postId]:v.engagement}))
     }catch{setExpanded(null)}
   }
 }
 const actor=state?.actor
 return <main className="page trucker-community">
   <header className="community-top">
     <div className="row-between"><Link className="back-link" href="/">← Driver home</Link><span className="community-preview">LOCAL PREVIEW</span></div>
     <div className="community-brand"><span className="community-emblem">🚛</span><div><div className="subtle">The road has a community</div><h1>Trucker Community</h1></div></div>
     <p className="subtle">Follow other drivers, share useful stops, trade advice, and keep in touch off-duty.</p>
   </header>
   {notice&&<p className="community-notice" role="status">{notice}</p>}
   {stage==="loading"&&<p className="card">Loading community…</p>}
   {stage==="locked"&&<section className="card stack"><h2>Community preview is locked</h2><p className="subtle">Social features are not publicly available yet. Driver Essentials is still available without joining.</p><Link className="btn btn-primary" href="/funfinder">Find showers, fuel and parking</Link></section>}
   {stage==="guest"&&<section className="card stack">
     <h2>{register?"Join the driver network":"Welcome back, driver"}</h2>
     <p className="subtle">Social and discovery are off by default. This is a local development preview.</p>
     <form onSubmit={auth} className="stack">
       {register&&<>
         <label>Driver handle<input required maxLength={32} autoComplete="username" placeholder="highway_hero" value={handle} onChange={e=>setHandle(e.target.value)}/></label>
         <label>Display name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
       </>}
       <label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
       <label>Password<input required type="password" minLength={register?12:1} maxLength={128} autoComplete={register?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label>
       <button className="btn btn-primary" disabled={busy}>{busy?"Working…":register?"Create profile":"Log in"}</button>
     </form>
     <button className="community-text-button" onClick={()=>{setRegister(!register);setNotice("")}}>{register?"Already registered? Log in":"New to the community? Register"}</button>
   </section>}
   {stage==="member"&&actor&&state&&<>
     <nav aria-label="Community tabs" className="community-tabs">
       <button className={tab==="feed"?"active":""} onClick={()=>setTab("feed")}>🏠 Feed</button>
       <button className={tab==="drivers"?"active":""} onClick={()=>setTab("drivers")}>👥 Drivers</button>
       <button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}>⚙️ Profile</button>
     </nav>
     {!actor.socialEnabled&&<section className="card stack"><h2>Join on your own terms</h2><p className="subtle">No posts, public profile, Crew-Up presence, or automatic live GPS sharing. You decide when social starts.</p><button className="btn btn-primary" disabled={busy} onClick={()=>void act({action:"settings",enabled:true},"Community enabled. Discovery remains private.")}>Opt in to community</button><Link href="/funfinder" className="btn">Use FunFinder without social</Link><button className="community-text-button" disabled={busy} onClick={()=>void act({action:"logout"}).then(ok=>{if(ok){setStage("guest");setState(null)}})}>Log out without joining</button></section>}
     {actor.socialEnabled&&tab==="feed"&&<>
       <section className="card stack community-composer">
         <div className="row"><span className="community-avatar">{monogram(actor.displayName)}</span><div><b>{actor.displayName}</b><div className="subtle">{"@"+actor.handle}</div></div></div>
         <form className="stack" onSubmit={publish}>
           <label className="sr-only" htmlFor="community-post">Post to the community</label>
           <textarea id="community-post" rows={3} maxLength={3000} required value={body} onChange={e=>setBody(e.target.value)} placeholder="Any good shower stops, safe parking tips, food finds, or road stories?"/>
           <label>Who can see it?<select value={audience} onChange={e=>setAudience(e.target.value as "friends"|"network")}><option value="friends">Friends only</option><option value="network">Driver network</option></select></label>
           <button className="btn btn-primary" disabled={busy||!body.trim()}>Share with drivers</button>
         </form>
       </section>
       <h2 className="community-section-heading">The road feed</h2>
       {state.feed.length===0&&<section className="card empty-state">Nothing here yet. Post a tip or connect with another driver.</section>}
       {state.feed.map(post=><article key={post.id} className="card community-post">
         <header className="row community-post-head"><span className="community-avatar">{monogram(post.displayName)}</span><div className="community-post-author"><b>{post.displayName}</b><div className="subtle">{"@"+post.handle+" · "+new Date(post.createdAt).toLocaleDateString()}</div></div><span className="community-audience">{post.audience==="friends"?"🔒 Friends":"🌐 Drivers"}</span></header>
         <p className="community-post-text">{post.body}</p>
         {post.kind!=="update"&&<p className="community-tip">Driver-reported {post.kind}{post.rating?" · "+post.rating+"/5":""}; independently unverified</p>}
         <div className="community-actions">
           <button aria-label="Like post" onClick={()=>void react(post.id,"like")}>♥ {counts[post.id]?.likedByMe?"Liked":"Like"}{counts[post.id]?" · "+counts[post.id].likeCount:""}</button>
           <button onClick={()=>void expand(post.id)}>💬 Comment{counts[post.id]?" · "+counts[post.id].commentCount:""}</button>
           <button onClick={()=>void react(post.id,"bookmark")}>{counts[post.id]?.bookmarkedByMe?"★ Saved":"☆ Save"}</button>
         </div>
         {expanded===post.id&&<section className="stack community-comments">
           {comments.length===0&&<p className="subtle">No visible comments yet.</p>}
           {comments.map(c=><div key={c.id} className="community-comment"><b>{"@"+c.handle}</b><span>{c.body}</span>{c.parentId&&<span className="subtle">↳ Reply</span>}</div>)}
           <form className="row" onSubmit={reply}>
             <label htmlFor="reply-input" className="sr-only">Comment</label>
             <input id="reply-input" required maxLength={2000} value={commentBody} onChange={e=>setCommentBody(e.target.value)} placeholder="Your comment…"/>
             <button disabled={busy||!commentBody.trim()} className="btn btn-primary">Send</button>
           </form>
         </section>}
       </article>)}
     </>}
     {actor.socialEnabled&&tab==="drivers"&&<>
       <section className="card stack"><h2>Requests ({state.incoming.length})</h2>{state.incoming.length===0&&<p className="subtle">No incoming requests.</p>}
         {state.incoming.map(d=><DriverRow key={d.id} member={d} action="Accept" disabled={busy} onClick={()=>void act({action:"acceptFriend",memberId:d.id},"Friend added.")}/>)}
       </section>
       <section className="card stack"><h2>Your friends</h2>{state.friends.length===0&&<p className="subtle">No driver friends yet.</p>}
         {state.friends.map(d=><DriverRow key={d.id} member={d} action="Block" disabled={busy} onClick={()=>void act({action:"block",memberId:d.id},"Driver blocked.")}/>)}
       </section>
       <section className="card stack"><h2>Discover drivers</h2><p className="subtle">Only profiles with voluntary discovery enabled appear here.</p>
         {state.discoverable.filter(d=>!state.friends.some(f=>f.id===d.id)).map(d=><DriverRow key={d.id} member={d} action="Connect" disabled={busy} onClick={()=>void act({action:"friendRequest",memberId:d.id},"Friend request sent.")}/>)}
       </section>
     </>}
     {actor.socialEnabled&&tab==="profile"&&<>
       <section className="card stack">
         <div className="row"><span className="community-avatar large">{monogram(actor.displayName)}</span><div><h2>{actor.displayName}</h2><p className="subtle">{"@"+actor.handle}</p></div></div>
         <form className="stack" onSubmit={e=>{e.preventDefault();void act({action:"profile",displayName:name,bio,region},"Profile saved.")}}>
           <label>Display name<input value={name} maxLength={80} required onChange={e=>setName(e.target.value)}/></label>
           <label>About you<textarea rows={3} maxLength={500} value={bio} onChange={e=>setBio(e.target.value)}/></label>
           <label>General region — optional<input value={region} maxLength={80} onChange={e=>setRegion(e.target.value)} placeholder="No precise GPS"/></label>
           <button className="btn btn-primary" disabled={busy}>Save profile</button>
         </form>
       </section>
       <section className="card stack"><h2>Privacy</h2>
         <label className="community-toggle">Discoverable to other drivers <input type="checkbox" checked={actor.discoverable} disabled={busy} onChange={e=>void act({action:"settings",discoverable:e.target.checked})}/></label>
         <label className="community-toggle">Crew-Up consent (future) <input type="checkbox" checked={actor.crewUpEnabled} disabled={busy} onChange={e=>void act({action:"settings",crewUpEnabled:e.target.checked})}/></label>
         <button className="btn" disabled={busy} onClick={()=>void act({action:"settings",enabled:false},"Social turned off. Your posts are hidden.")}>Turn social off</button>
         <button className="community-text-button" disabled={busy} onClick={()=>void act({action:"logout"}).then(()=>{setStage("guest");setState(null)})}>Log out</button>
       </section>
     </>}
   </>}
   <nav className="community-bottom-nav"><Link href="/">🚛 Home</Link><Link href="/funfinder">🚿 FunFinder</Link><Link href="/dispatcher">🧭 Dispatcher</Link></nav>
   <p className="community-safety-note">Use while parked or off duty. No automatic location broadcasting and no community features required for FunFinder.</p>
 </main>
}
function DriverRow({member,action,disabled,onClick}:{member:Actor;action:string;disabled:boolean;onClick:()=>void}){
 return <div className="community-driver-row"><span className="community-avatar">{monogram(member.displayName)}</span><div className="community-driver-name"><b>{member.displayName}</b><span className="subtle">{"@"+member.handle+(member.region?" · "+member.region:"")}</span></div><button disabled={disabled} className="btn" onClick={onClick}>{action}</button></div>
}
