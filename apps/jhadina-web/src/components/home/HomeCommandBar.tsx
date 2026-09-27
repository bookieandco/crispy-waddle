"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/router"
import { getCurrentUserId } from "@/lib/auth/current-user"

type UploadedArtifact={id:string;name:string;status:string;contextReady?:boolean;extractionStatus?:string}

export function HomeCommandBar(){
 const router=useRouter()
 const fileRef=useRef<HTMLInputElement>(null)
 const [prompt,setPrompt]=useState("")
 const [uploading,setUploading]=useState(false)
 const [artifacts,setArtifacts]=useState<UploadedArtifact[]>([])
 const [status,setStatus]=useState("")

 async function upload(files:FileList|null){
  if(!files?.length||uploading)return
  const userId=await getCurrentUserId()
  if(!userId){setStatus("Sign in before attaching files.");return}
  setUploading(true)
  try{
   for(const file of Array.from(files).slice(0,4)){
    setStatus("Uploading "+file.name+"…")
    const form=new FormData();form.append("file",file)
    const response=await fetch("/api/jhadina/artifacts",{method:"POST",headers:{"x-jhadina-user-id":userId},body:form})
    const json=await response.json().catch(()=>({}))
    if(!response.ok){setStatus(file.name+": "+(json.error??"upload failed"));continue}
    const artifact=json.artifact as UploadedArtifact
    setArtifacts(current=>[...current.filter(item=>item.id!==artifact.id),artifact].slice(-4))
    setStatus(artifact.status==="clean"?(artifact.contextReady?file.name+" is ready for Jhadina.":file.name+" passed scanning; extraction is pending."):file.name+" will not enter reasoning context ("+artifact.status+").")
   }
  }finally{setUploading(false)}
 }

 function submit(){
  const ready=artifacts.filter(item=>item.status==="clean"&&item.contextReady).map(item=>item.id)
  const query=new URLSearchParams({surface:"home",route:"/"})
  if(prompt.trim())query.set("prompt",prompt.trim())
  if(ready.length)query.set("artifacts",ready.join(","))
  router.push("/ask-jhadina?"+query.toString())
 }

 return <section className="jh-command-bar" aria-label="Ask Jhadina or search">
  <div className="jh-command-main">
   <span className="jh-command-spark" aria-hidden="true">✦</span>
   <input value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")submit()}} placeholder="Ask Jhadina or search anything…" aria-label="Ask Jhadina or search anything"/>
   <button className="jh-command-icon" type="button" disabled={uploading} onClick={()=>fileRef.current?.click()} aria-label="Attach files">＋</button>
   <button className="jh-command-send" type="button" onClick={submit}>Ask</button>
   <input ref={fileRef} type="file" multiple hidden accept="image/png,image/jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/json,audio/wav,audio/mpeg,audio/mp4,audio/webm,video/mp4,video/webm,.png,.jpg,.jpeg,.pdf,.docx,.xlsx,.txt,.csv,.json,.wav,.mp3,.m4a,.webm,.mp4" onChange={event=>void upload(event.target.files)}/>
  </div>
  {artifacts.length?<div className="jh-command-files">{artifacts.map(item=><span className={item.status==="clean"&&item.contextReady?"jh-file-chip jh-file-chip--ready":"jh-file-chip"} key={item.id}>{item.name}</span>)}</div>:null}
  {status?<p className="jh-command-status" role="status">{status}</p>:null}
 </section>
}
