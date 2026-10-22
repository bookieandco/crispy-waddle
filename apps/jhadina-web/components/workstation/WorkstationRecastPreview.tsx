'use client'

import {useCallback,useEffect,useState} from 'react'
import {getCurrentUserId} from '@/lib/auth/current-user'

type Role='footage'|'reference'|'audio'
type Input={artifactId:string;role:Role;label:string;mimeType:string;sizeBytes:number;clean:boolean}
type Readiness={
  ok?:boolean;error?:string;mediaVerified?:boolean;readyForRender?:boolean;
  castAppearanceMatched?:boolean;characterId?:string|null;appearanceVariantId?:string|null;
  reviewStore?:'NOT_COMMISSIONED'|'INCOMPLETE'|'REVIEWED_READ_ONLY';reviewReceiptsComplete?:boolean;
  blockers?:string[];verifiedAssetIds?:string[];status?:string;
}

/**
 * Recast's owner media picker reuses Director Project Inputs; it never
 * manufactures an approved tracking/voice record or invokes a render worker.
 */
export function WorkstationRecastPreview({projectId}:{projectId:string}) {
  const [inputs,setInputs]=useState<Input[]>([])
  const [video,setVideo]=useState('')
  const [image,setImage]=useState('')
  const [audio,setAudio]=useState('')
  const [duration,setDuration]=useState(10)
  const [consent,setConsent]=useState('')
  const [rights,setRights]=useState('')
  const [tracking,setTracking]=useState('')
  const [characterTrack,setCharacterTrack]=useState('')
  const [voiceReceipt,setVoiceReceipt]=useState('')
  const [loading,setLoading]=useState(false)
  const [uploading,setUploading]=useState<Role|null>(null)
  const [error,setError]=useState('')
  const [readiness,setReadiness]=useState<Readiness|null>(null)
  const [storageStatus,setStorageStatus]=useState<{sourceUploadReady:boolean;nextBlockingGate:string}|null>(null)

  const refresh=useCallback(async()=>{
    setLoading(true);setError('');setReadiness(null)
    try{
      const schemaResponse=await fetch('/api/director/recast/readiness?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
      const schema=await schemaResponse.json() as {ok?:boolean;sourceUploadReady?:boolean;nextBlockingGate?:string;error?:string}
      if(!schemaResponse.ok||!schema.ok)throw new Error(schema.error??'Storage schema inspection unavailable')
      setStorageStatus({sourceUploadReady:Boolean(schema.sourceUploadReady),nextBlockingGate:schema.nextBlockingGate??'DIRECTOR_RECAST_STORAGE_NOT_READY'})
      if(!schema.sourceUploadReady){setInputs([]);return}
      const response=await fetch('/api/director/recast/preflight?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
      const body=await response.json() as {ok?:boolean;inputs?:Input[];error?:string}
      if(!response.ok||!body.ok)throw new Error(body.error??'Media lookup unavailable')
      setInputs(body.inputs??[])
    }catch(e){setError(e instanceof Error?e.message:'Unable to load project media')}
    finally{setLoading(false)}
  },[projectId])

  useEffect(()=>{void refresh()},[refresh])

  async function uploadFor(role:Role,file:File){
    if(uploading||loading||storageStatus?.sourceUploadReady!==true)return
    setError('');setReadiness(null);setUploading(role)
    try{
      if(file.size<=0||file.size>100*1024*1024)throw new Error('Select a nonempty file under 100 MB; server limits may be lower')
      const userId=await getCurrentUserId()
      if(!userId)throw new Error('Sign in before uploading a Director asset')
      const form=new FormData()
      form.append('file',file)
      const uploaded=await fetch('/api/jhadina/artifacts',{
        method:'POST',headers:{'x-jhadina-user-id':userId},body:form,
      })
      const data=await uploaded.json() as {success?:boolean;error?:string;artifact?:{id:string;status:string}}
      if(!uploaded.ok||!data.success||!data.artifact)throw new Error(data.error??'Artifact scan failed')
      if(data.artifact.status!=='clean')throw new Error('Artifact did not pass the required clean scan')
      const bound=await fetch('/api/workstation/inputs',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({projectId,artifactId:data.artifact.id,role,label:file.name}),
      })
      const binding=await bound.json() as {ok?:boolean;error?:string}
      if(!bound.ok||!binding.ok)throw new Error(binding.error??'Could not attach file to project')
      await refresh()
      if(role==='footage')setVideo(data.artifact.id)
      else if(role==='reference')setImage(data.artifact.id)
      else setAudio(data.artifact.id)
    }catch(e){setError(e instanceof Error?e.message:'Upload failed')}
    finally{setUploading(null)}
  }

  async function preflight(){
    setError('');setReadiness(null);setLoading(true)
    try{
      const response=await fetch('/api/director/recast/preflight',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          projectId,sourceVideoAssetId:video,replacementCharacterAssetId:image,
          sourceAudioAssetId:audio,durationSeconds:duration,
        }),
      })
      const result=await response.json() as Readiness
      if(!response.ok||!result.ok)throw new Error(result.error??'Preview preflight failed')
      setReadiness(result)
    }catch(e){setError(e instanceof Error?e.message:'Preview preflight failed')}
    finally{setLoading(false)}
  }

  function exportManifest(){
    if(!readiness?.mediaVerified||readiness.readyForRender)return
    const draft={
      schemaVersion:'director.recast.intake.v2',projectId,
      sourceVideoAssetId:video,replacementCharacterAssetId:image,sourceAudioAssetId:audio,
      sourceDurationSeconds:duration,
      replacementMode:'character-only',environmentMode:'preserve-source',
      audioMode:'resync-after-swap',renderMode:'preview',
      consentReceiptId:consent.trim(),mediaRightsReceiptId:rights.trim(),
      trackingArtifactId:tracking.trim(),characterTrackId:characterTrack.trim(),
      voiceSyncEvidenceRef:voiceReceipt.trim(),
      untrustedClientPreflightClaim:true,
      revalidateAllEvidenceOnServer:true,
      castAppearanceMatchedAtLastRead:Boolean(readiness.castAppearanceMatched),
      verifiedAssetIds:readiness.verifiedAssetIds,
      evidenceStatus:'ALL_APPROVAL_RECEIPTS_UNVERIFIED',
      blockers:readiness.blockers,
      executionAuthority:'NONE',publicationAuthority:'NONE',costAuthority:'NONE',
    }
    const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}))
    const link=document.createElement('a')
    link.href=url;link.download='director-recast-UNVERIFIED.json';link.click()
    window.setTimeout(()=>URL.revokeObjectURL(url),3000)
  }

  const select=(role:Role,value:string,setter:(value:string)=>void,label:string)=>(
    <div className="space-y-2">
      <label className="block space-y-1 text-sm">{label}
        <select value={value} onChange={e=>{setter(e.target.value);setReadiness(null)}} className="w-full min-w-0 rounded border bg-background p-2">
          <option value="">Select uploaded {role}</option>
          {inputs.filter(input=>input.role===role).map(input=><option key={input.artifactId} value={input.artifactId}>
            {input.clean?'✓':'Not clean ·'} {input.label} ({input.mimeType})
          </option>)}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        {uploading===role?'Scanning and attaching…':role==='footage'?'Or upload a video':role==='reference'?'Or upload a character photo':'Or upload audio'}
        <input type="file" disabled={Boolean(uploading)||loading||storageStatus?.sourceUploadReady!==true}
          accept={role==='footage'?'video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm':role==='reference'?'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp':'audio/wav,audio/mpeg,audio/mp4,.wav,.mp3,.m4a'}
          onChange={e=>{const file=e.target.files?.[0];if(file)void uploadFor(role,file);e.target.value=''}}
          className="mt-1 block w-full max-w-full text-xs disabled:opacity-50"/>
      </label>
    </div>
  )

  return <section id="director-recast" className="space-y-4 rounded-xl border bg-background p-4">
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Director Casting Room / Character Recast</p>
      <h2 className="text-lg font-semibold">Original scene · lip-sync · preview</h2>
      <p className="text-sm text-muted-foreground">
        Select clean, owner-scoped media already attached to this Director project. Only a verified source-media preflight is active;
        character tracking, voice permission, likeness consent and actual render are not certified. You can upload directly from your iPhone using the existing scanned Artifact Core path.
      </p>
    </div>
    {storageStatus&&!storageStatus.sourceUploadReady?
      <div role="status" className="rounded border p-3 text-sm">
        Director uploads are blocked because required project storage is not installed or accessible.
        <p className="mt-1 text-xs text-muted-foreground">{storageStatus.nextBlockingGate.replaceAll('_',' ').toLowerCase()} — no paid rendering or database change has been attempted.</p>
      </div>:null}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={loading} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void refresh()}>
        {loading?'Checking…':'Refresh attached media'}
      </button>
      <a href="#director-project-inputs" className="rounded border px-3 py-2 text-sm">Open Project Inputs to upload</a>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {select('footage',video,setVideo,'Original footage')}
      {select('reference',image,setImage,'Replacement character reference')}
      {select('audio',audio,setAudio,'Audio for lip-sync')}
      <label className="text-sm">Declared duration · 1–30s
        <input type="number" min={1} max={30} value={duration} onChange={e=>{setDuration(Number(e.target.value));setReadiness(null)}}
          className="mt-1 w-full rounded border bg-background p-2"/>
      </label>
    </div>
    <p className="text-xs text-muted-foreground">Duration must still be checked against decoded footage by a trusted media worker.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {([
        ['Consent evidence reference',consent,setConsent],
        ['Footage/image rights reference',rights,setRights],
        ['Tracking artifact reference',tracking,setTracking],
        ['Reviewed character track reference',characterTrack,setCharacterTrack],
        ['Voice-sync review evidence reference',voiceReceipt,setVoiceReceipt],
      ] as const).map(([label,value,setter])=><label key={label} className="text-sm">{label}
        <input value={value} onChange={e=>{setter(e.target.value);setReadiness(null)}}
          className="mt-1 w-full rounded border bg-background p-2" placeholder="Unverified until authenticated review"/>
      </label>)}
    </div>
    <button type="button" disabled={loading||storageStatus?.sourceUploadReady!==true||!video||!image||!audio} onClick={()=>void preflight()}
      className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Verify source media (no render)</button>
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
    {readiness?<div className="space-y-2 rounded-lg border p-3">
      <p role="status" className="text-sm font-semibold">
        {readiness.mediaVerified?'Clean project-bound media verified':'Media verification blocked'} · Rendering disabled
      </p>
      <p className="text-xs text-muted-foreground">This is an intake/preflight result, not a render permit or verified consent.</p>
      <p className="text-xs text-muted-foreground">{readiness.castAppearanceMatched?`Reviewed Cast appearance found: ${readiness.characterId} (${readiness.appearanceVariantId})`:'Character appearance has not been matched to an approved Cast record.'}</p>
      <p className="text-xs text-muted-foreground">{readiness.reviewReceiptsComplete?'Read-only review receipts matched — live rendering still requires separate approval':readiness.reviewStore==='NOT_COMMISSIONED'?'Recast review registry not commissioned': 'Tracking, voice, duration and consent review receipts still required'}</p>
      <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
        {(readiness.blockers??[]).map(blocker=><li key={blocker}>{blocker.replace(/^DIRECTOR_RECAST_/,'').replaceAll('_',' ').toLowerCase()}</li>)}
      </ul>
      {readiness.mediaVerified?<button type="button" onClick={exportManifest} className="rounded border px-3 py-2 text-sm">Export blocked preview handoff</button>:null}
    </div>:null}
  </section>
}
