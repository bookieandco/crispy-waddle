"use client"

import {useCallback,useEffect,useState,type FormEvent} from "react"
import Link from "next/link"

type Status="loading"|"locked"|"guest"|"off"|"ready"|"error"
type Amenity="showers"|"parking"|"fuel"|"laundry"|"repairs"|"restrooms"|"food"|"general"
type Review={id:string;authorId:string;handle:string;displayName:string;body:string;rating:number;amenity:Amenity;observedAt:string|null;createdAt:string;audience:"network"|"friends";provenance:"driver_self_report"}
type Actor={socialEnabled:boolean}
const AMENITIES:Amenity[]=["showers","parking","fuel","laundry","repairs","restrooms","food","general"]
const REASONS=[["inaccurate_place_info","Incorrect stop information"],["unsafe_information","Unsafe advice"],["harassment","Harassment"],["spam","Spam"],["other","Other"]] as const

async function mutate(payload:Record<string,unknown>){
 const r=await fetch("/api/community",{method:"POST",credentials:"same-origin",cache:"no-store",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
 const j=await r.json() as {success:boolean;error?:string}
 if(!r.ok||!j.success)throw Error(j.error??"Unable to submit")
}
function dateLabel(value:string){
 const date=new Date(value)
 return Number.isNaN(date.getTime())?"Date unavailable":date.toLocaleDateString()
}

/** Reviews appear only to an authenticated participant who opted into social.
 * Provider ratings and truck attributes are NEVER altered by these opinions.
 */
export function DriverPlaceReviews({placeId,placeName}:{placeId:string;placeName:string}){
 const [status,setStatus]=useState<Status>("loading")
 const [reviews,setReviews]=useState<Review[]>([])
 const [body,setBody]=useState("")
 const [amenity,setAmenity]=useState<Amenity>("showers")
 const [rating,setRating]=useState(5)
 const [observedAt,setObservedAt]=useState("")
 const [audience,setAudience]=useState<"friends"|"network">("friends")
 const [reporting,setReporting]=useState<string|null>(null)
 const [reason,setReason]=useState<string>("inaccurate_place_info")
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState("")

 const load=useCallback(async()=>{
   const me=await fetch("/api/community",{cache:"no-store",credentials:"same-origin"})
   if(me.status===503){setStatus("locked");return}
   if(me.status===401){setStatus("guest");return}
   if(!me.ok)throw Error("Unable to verify community login")
   const obj=await me.json() as {success:boolean;data?:{actor:Actor}}
   if(!obj.success||!obj.data)throw Error("Community login unavailable")
   if(!obj.data.actor.socialEnabled){setStatus("off");return}
   const res=await fetch("/api/community/place-reviews?placeId="+encodeURIComponent(placeId),{
     cache:"no-store",credentials:"same-origin"
   })
   const payload=await res.json() as {success:boolean;data?:{reviews:Review[]}}
   if(!res.ok||!payload.success||!payload.data)throw Error("Unable to load reviews")
   setReviews(payload.data.reviews);setStatus("ready")
 },[placeId])

 useEffect(()=>{void load().catch(()=>setStatus("error"))},[load])

 async function submit(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setBusy(true);setMessage("")
   try{
     await mutate({action:"review",placeId,amenity,rating,body,audience,observedAt:observedAt||null})
     setBody("");setObservedAt("");setMessage("Your driver-reported review was shared with the selected audience.")
     await load()
   }catch(error){setMessage(error instanceof Error?error.message:"Review could not be saved")}
   finally{setBusy(false)}
 }
 async function report(id:string){
   setBusy(true);setMessage("")
   try{
     await mutate({action:"report",postId:id,reason})
     setReporting(null)
     setMessage("Report recorded. This post is hidden for you, pending moderator review.")
     await load()
   }catch(error){setMessage(error instanceof Error?error.message:"Unable to report")}
   finally{setBusy(false)}
 }
 return <section className="card stack" aria-label={"Driver reviews for "+placeName}>
   <div className="row-between"><h2 className="h1">Driver community reviews</h2><span className="badge badge-user-reported">Self-reported</span></div>
   <p className="subtle">Experience reports from drivers, not provider-verified facts. Parking legality, vehicle access, safety and live availability must be checked independently.</p>
   {status==="loading"&&<div className="subtle">Loading reviews…</div>}
   {status==="locked"&&<p className="subtle">The community preview has not been launched publicly. FunFinder is still usable without social.</p>}
   {status==="guest"&&<p className="subtle">To share or see driver reviews, <Link className="back-link" href="/community">sign in to the optional driver community</Link>.</p>}
   {status==="off"&&<p className="subtle">Your community participation is off. <Link className="back-link" href="/community">Manage your opt-in</Link>.</p>}
   {status==="error"&&<p className="subtle">Community reviews are temporarily unavailable. Provider information above is unaffected.</p>}
   {message&&<div role="status" className="community-notice">{message}</div>}
   {status==="ready"&&<>
     <form className="stack" onSubmit={submit}>
       <h3 style={{fontSize:14,margin:0}}>Review {placeName}</h3>
       <label>Amenity
         <select value={amenity} onChange={e=>setAmenity(e.target.value as Amenity)}>
           {AMENITIES.map(a=><option key={a} value={a}>{a.replace(/_/g," ")}</option>)}
         </select>
       </label>
       <label>Rating (your own experience)
         <select value={rating} onChange={e=>setRating(Number(e.target.value))}>
           {[5,4,3,2,1].map(v=><option key={v} value={v}>{v} / 5</option>)}
         </select>
       </label>
       <label>Date observed (optional; self-reported)
         <input type="date" max={new Date().toISOString().slice(0,10)} value={observedAt} onChange={e=>setObservedAt(e.target.value)}/>
       </label>
       <label>Your observation<textarea required rows={3} maxLength={3000} value={body}
         onChange={e=>setBody(e.target.value)} placeholder="When you visited, how were the showers, truck access or parking? Avoid disclosing anyone's live location."/>
       </label>
       <label>Who can see it?
         <select value={audience} onChange={e=>setAudience(e.target.value as "friends"|"network")}>
           <option value="friends">Friends only</option><option value="network">Driver network</option>
         </select>
       </label>
       <button className="btn btn-primary" disabled={busy||!body.trim()}>Publish your review</button>
     </form>
     <div className="stack" style={{marginTop:12}}>
       <h3 style={{fontSize:14,margin:0}}>Recent reviews ({reviews.length})</h3>
       {reviews.length===0&&<p className="subtle">No reviews visible to you yet. Your own review can start the conversation.</p>}
       {reviews.map(review=><article className="community-review" key={review.id}>
         <div className="row-between"><b>@{review.handle}</b><span className="subtle">{dateLabel(review.createdAt)}</span></div>
         <div className="subtle">★ {review.rating}/5 · {review.amenity} · {review.audience==="friends"?"Friends only":"Driver network"}</div>
         {review.observedAt&&<div className="subtle">Reported visit: {review.observedAt}</div>}
         <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",lineHeight:1.5,margin:"7px 0"}}>{review.body}</p>
         <div className="subtle">Unverified driver observation · {dateLabel(review.createdAt)}</div>
         <button type="button" className="community-text-button" onClick={()=>setReporting(reporting===review.id?null:review.id)}>Report this review</button>
         {reporting===review.id&&<div className="stack">
           <label>Why are you reporting it?
             <select value={reason} onChange={e=>setReason(e.target.value)}>
               {REASONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
             </select>
           </label>
           <button className="btn" disabled={busy} onClick={()=>void report(review.id)}>Submit report and hide</button>
         </div>}
       </article>)}
     </div>
   </>}
 </section>
}
