'use client'

import {useEffect,useRef,useState} from 'react'

const REVIEW_LABELS=[
  'Replacement stays on the intended character',
  'Original camera movement and timing are preserved',
  'Lighting, background and scene match',
  'Edges and face motion remain natural',
  'Lip movement follows the original audio',
] as const

/** Owner-local comparison only. Both videos are browser-created object URLs.
 * A checked box is NOT a QC receipt, model approval or render authorization. */
export function WorkstationRecastPlaybackAcceptance(){
  const [sourceFile,setSourceFile]=useState<File|null>(null)
  const [previewFile,setPreviewFile]=useState<File|null>(null)
  const [sourceUrl,setSourceUrl]=useState('')
  const [previewUrl,setPreviewUrl]=useState('')
  const [sourceSeconds,setSourceSeconds]=useState<number|null>(null)
  const [previewSeconds,setPreviewSeconds]=useState<number|null>(null)
  const [checks,setChecks]=useState<boolean[]>(()=>REVIEW_LABELS.map(()=>false))
  const sourceEl=useRef<HTMLVideoElement|null>(null)
  const previewEl=useRef<HTMLVideoElement|null>(null)

  useEffect(()=>{
    if(!sourceFile){setSourceUrl('');return}
    const url=URL.createObjectURL(sourceFile)
    setSourceUrl(url)
    return()=>URL.revokeObjectURL(url)
  },[sourceFile])
  useEffect(()=>{
    if(!previewFile){setPreviewUrl('');return}
    const url=URL.createObjectURL(previewFile)
    setPreviewUrl(url)
    return()=>URL.revokeObjectURL(url)
  },[previewFile])

  const durationsValid=sourceSeconds!==null&&previewSeconds!==null&&
    Number.isFinite(sourceSeconds)&&Number.isFinite(previewSeconds)&&
    sourceSeconds>0&&sourceSeconds<=30&&previewSeconds>0&&previewSeconds<=30
  const aligned=durationsValid&&Math.abs(sourceSeconds-previewSeconds)<=0.25
  const localReviewed=Boolean(aligned&&checks.every(Boolean))

  function chooseFile(kind:'source'|'preview',file:File|undefined){
    if(!file)return
    if(!['video/mp4','video/quicktime','video/webm'].includes(file.type))return
    setChecks(REVIEW_LABELS.map(()=>false))
    if(kind==='source'){setSourceSeconds(null);setSourceFile(file)}
    else{setPreviewSeconds(null);setPreviewFile(file)}
  }
  function replay(){
    if(!sourceEl.current||!previewEl.current)return
    sourceEl.current.pause();previewEl.current.pause()
    sourceEl.current.currentTime=0;previewEl.current.currentTime=0
    void sourceEl.current.play().catch(()=>{})
    void previewEl.current.play().catch(()=>{})
  }

  return <section aria-labelledby="recast-acceptance-title" className="space-y-4 rounded-xl border p-4">
    <div className="space-y-1">
      <h2 id="recast-acceptance-title" className="text-lg font-semibold">Recast playback acceptance</h2>
      <p className="text-sm text-muted-foreground">Compare two MP4, MOV or WebM clips on your iPhone. Videos stay in this browser and are not uploaded by this panel. No automatic scoring or approval.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {([
        {title:'Original footage',file:sourceFile,url:sourceUrl,ref:sourceEl,
          kind:'source' as const,seconds:sourceSeconds,setSeconds:setSourceSeconds},
        {title:'Recast preview',file:previewFile,url:previewUrl,ref:previewEl,
          kind:'preview' as const,seconds:previewSeconds,setSeconds:setPreviewSeconds},
      ]).map(item=><div key={item.kind} className="space-y-2">
        <label className="block text-sm font-medium">{item.title}
          <input aria-label={'Choose '+item.title} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            className="mt-2 block w-full text-xs" onChange={e=>chooseFile(item.kind,e.target.files?.[0])}/>
        </label>
        {item.url?<video key={item.url} ref={item.ref} src={item.url} controls playsInline preload="metadata"
          className="w-full max-h-80 rounded-lg bg-black object-contain"
          onLoadedMetadata={e=>item.setSeconds(e.currentTarget.duration)}
          onError={()=>item.setSeconds(null)}/>
          :<div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Choose a local video</div>}
        <p className="text-xs text-muted-foreground">{item.file?.name??'No video selected'} · {item.seconds===null?'Unmeasured':item.seconds.toFixed(2)+' sec'}</p>
      </div>)}
    </div>
    <button type="button" onClick={replay} disabled={!sourceUrl||!previewUrl||!aligned}
      className="rounded border px-3 py-2 text-sm disabled:opacity-50">Play both from start</button>
    {sourceSeconds!==null&&previewSeconds!==null?
      <p role="status" className="text-sm">{aligned?'Durations aligned within 250 ms (local browser estimate)':'Clips must each be 30 seconds or less and within 250 ms of each other.'}</p>:null}
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Manual visual review checklist</legend>
      {REVIEW_LABELS.map((label,i)=><label key={label} className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={checks[i]} onChange={e=>setChecks(old=>old.map((v,j)=>j===i?e.target.checked:v))}
          className="mt-1"/>
        <span>{label}</span>
      </label>)}
    </fieldset>
    <p role="status" className="text-sm font-medium">{localReviewed?
      'Manual comparison marked complete on this device — NOT certified or authorized for publication.' :
      'Manual comparison incomplete — no approval or publishing authority.'}</p>
  </section>
}
