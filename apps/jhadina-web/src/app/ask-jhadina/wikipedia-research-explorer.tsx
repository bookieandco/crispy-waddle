"use client"

import {useEffect,useRef,useState} from "react"
import {getCurrentUserId} from "@/lib/auth/current-user"
import {validWikiQuery,type WikiResearchResult} from "@/lib/intelligence/wikipedia-public-research"

/** Opt-in public search: does not forward JLLM's transcript, attachments,
 * Money/Memory context, or private identifiers as query material.
 */
export function WikipediaResearchExplorer(){
 const [query,setQuery]=useState("")
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const [data,setData]=useState<WikiResearchResult|null>(null)
 const abortRef=useRef<AbortController|null>(null)
 useEffect(()=>()=>abortRef.current?.abort(),[])
 async function research(){
  const q=validWikiQuery(query)
  if(!q){setError("Enter a public search phrase (3–120 characters).");return}
  abortRef.current?.abort()
  const controller=new AbortController();abortRef.current=controller
  setBusy(true);setError("");setData(null)
  try{
   const userId=await getCurrentUserId()
   if(!userId)throw Error("Sign in before researching")
   const response=await fetch("/api/jhadina/research/wikipedia?q="+encodeURIComponent(q),{
    method:"GET",cache:"no-store",signal:controller.signal,headers:{"x-jhadina-user-id":userId},
   })
   const json=await response.json()
   if(!response.ok||!json?.success)throw Error(json?.error||"Research source unavailable")
   if(!controller.signal.aborted)setData(json.data as WikiResearchResult)
  }catch(e){
   if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Public lookup unavailable")
  }finally{if(abortRef.current===controller){setBusy(false);abortRef.current=null}}
 }
 return <details className="jh-item" style={{marginTop:12}}>
  <summary style={{cursor:"pointer",fontWeight:600}}>Free source lookup · Wikipedia</summary>
  <p className="jh-meta">Owner-triggered public encyclopedia research. Only the search phrase leaves Jhadina. Wikipedia articles are attributed source candidates, not independent verification. For current or high-stakes facts, confirm with primary sources.</p>
  <form className="jh-row" onSubmit={event=>{event.preventDefault();void research()}}>
   <label htmlFor="jhadina-wiki-query" className="jh-eyebrow">Public topic</label>
   <input id="jhadina-wiki-query" className="jh-input" type="search" maxLength={120}
    placeholder="What should I look up?" value={query} onChange={event=>setQuery(event.target.value)} style={{flex:"1 1 200px"}}/>
   <button className="jh-button" type="submit" disabled={busy||!validWikiQuery(query)}>{busy?"Searching…":"Find sources"}</button>
  </form>
  {error?<p className="jh-error" role="alert">{error}</p>:null}
  {data?.items.length===0?<p className="jh-meta">No matching source snippets were found.</p>:null}
  {data?.items.map(page=><div className="jh-item" key={page.pageId} style={{marginTop:8}}>
   <a href={page.url} target="_blank" rel="noopener noreferrer"><strong>{page.title}</strong></a>
   <p className="jh-card-copy">{page.summary||"Open the linked source for full text."}</p>
   <p className="jh-meta">Source: English Wikipedia · Page ID {page.pageId} · Not independently verified</p>
  </div>)}
 </details>
}
