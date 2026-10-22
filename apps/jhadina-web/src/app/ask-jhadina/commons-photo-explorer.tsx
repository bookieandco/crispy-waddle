"use client"

import { useEffect, useRef, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { parseCommonsSearchResult, validCommonsSearchQuery, type CommonsSearchResult } from "@/lib/intelligence/commons-media"

/**
 * Public-media discovery must be explicitly initiated; query is entered
 * by the owner. No JLLM prompt, conversation history or artifact is sent.
 */
export function CommonsPhotoExplorer(){
  const [query,setQuery]=useState("")
  const [data,setData]=useState<CommonsSearchResult|null>(null)
  const [error,setError]=useState("")
  const [busy,setBusy]=useState(false)
  const [index,setIndex]=useState(0)
  const abort=useRef<AbortController|null>(null)
  useEffect(()=>()=>abort.current?.abort(),[])

  async function search(){
    const normalized=validCommonsSearchQuery(query)
    if(!normalized){setError("Enter 3–120 characters for a public search.");return}
    abort.current?.abort()
    const controller=new AbortController()
    abort.current=controller
    setBusy(true);setError("");setData(null);setIndex(0)
    try{
      const owner=await getCurrentUserId()
      if(!owner)throw new Error("Sign in before searching")
      const response=await fetch("/api/jhadina/visual-media?q="+encodeURIComponent(normalized),{
        method:"GET",cache:"no-store",signal:controller.signal,
        headers:{"x-jhadina-user-id":owner},
      })
      const json=await response.json() as {success?:boolean;data?:unknown;error?:string}
      if(!response.ok || !json.success)throw new Error(json.error||"Public search unavailable")
      const validated=parseCommonsSearchResult(json.data)
      if(!validated)throw new Error("Unverified media response")
      if(!controller.signal.aborted)setData(validated)
    }catch(cause){
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Public photo search unavailable")
    }finally{if(abort.current===controller){abort.current=null;setBusy(false)}}
  }

  const images=data?.images??[]
  const active=images[index]
  return <section aria-label="Search credited public photographs" style={{marginTop:18}}>
    <h3 className="jh-card-title">Public photo exploration</h3>
    <p className="jh-card-copy">Search Wikimedia Commons only if you want a public lookup. Your search phrase will be sent to Wikimedia when you press Search; Jhadina does not send your chat or files. Search results are not evidence that a photograph depicts the exact subject.</p>
    <form onSubmit={event=>{event.preventDefault();void search()}} className="jh-row" style={{marginTop:12,alignItems:"center"}}>
      <label htmlFor="jh-commons-visual-query" className="jh-eyebrow">Public search</label>
      <input id="jh-commons-visual-query" className="jh-input" type="search" placeholder="e.g. Trinity College Dublin library" maxLength={120} autoComplete="off" value={query} onChange={event=>setQuery(event.target.value)} style={{flex:"1 1 240px",minWidth:0}}/>
      <button type="submit" className="jh-button" disabled={busy||!validCommonsSearchQuery(query)}>{busy?"Searching…":"Search photos"}</button>
    </form>
    {error?<p className="jh-error" role="alert">{error}</p>:null}
    {data&&images.length===0?<p role="status" className="jh-meta">No compatible, attributed images were returned. Try a different phrase.</p>:null}
    {active?<div className="jh-item" style={{marginTop:12}}>
      <p className="jh-meta" aria-live="polite">Public candidate {index+1} of {images.length} · relevance not verified</p>
      {/* The src host and path are revalidated by parseCommonsSearchResult. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={active.imageUrl} alt={"Wikimedia Commons search candidate: "+active.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{maxWidth:"100%",height:"auto",maxHeight:380,objectFit:"contain",borderRadius:10,marginTop:10}}/>
      <p className="jh-card-copy"><strong>{active.title}</strong></p>
      <p className="jh-meta">Attribution: {active.author} · {active.license}</p>
      <div className="jh-row" style={{marginTop:10,alignItems:"center"}}>
        <button type="button" className="jh-button" onClick={()=>setIndex(i=>Math.max(0,i-1))} disabled={index===0}>Previous photo</button>
        <button type="button" className="jh-button" onClick={()=>setIndex(i=>Math.min(images.length-1,i+1))} disabled={index===images.length-1}>Next photo</button>
        <a className="jh-button" href={active.sourceUrl} target="_blank" rel="noopener noreferrer">Source / attribution</a>
        <a className="jh-button" href={active.licenseUrl} target="_blank" rel="noopener noreferrer">License</a>
      </div>
    </div>:null}
  </section>
}
