'use client'

import { useState } from 'react'
/** Operator-only preparation: actual asset IDs and approved tracking receipts
 * must be sourced from canonical Director. No upload, worker call or spending. */
export function WorkstationRecastPreview({ projectId }: { projectId: string }) {
  const [video, setVideo] = useState('')
  const [image, setImage] = useState('')
  const [audio, setAudio] = useState('')
  const [tracking, setTracking] = useState('')
  const [characterTrack, setCharacterTrack] = useState('')
  const [voiceTrack, setVoiceTrack] = useState('')
  const [consent, setConsent] = useState('')
  const [rights, setRights] = useState('')
  const [duration, setDuration] = useState(10)
  const [error, setError] = useState('')
  const [prepared, setPrepared] = useState(false)

  function prepare() {
    setError('')
    setPrepared(false)
    if (![video,image,audio,tracking,characterTrack,voiceTrack,consent,rights].every(value=>value.trim())) {
      setError('All asset and evidence reference fields are required')
      return
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 30) {
      setError('Clip must be 1–30 seconds')
      return
    }
    const manifest = {
      schemaVersion:'director.recast.intake.v1',
      projectId, sourceVideoAssetId:video.trim(),
      replacementCharacterAssetId:image.trim(), sourceAudioAssetId:audio.trim(),
      trackingArtifactId:tracking.trim(), characterTrackId:characterTrack.trim(),
      voiceTrackId:voiceTrack.trim(), consentReceiptId:consent.trim(),
      mediaRightsReceiptId:rights.trim(), sourceDurationSeconds:duration,
      replacementMode:'character-only', environmentMode:'preserve-source',
      audioMode:'resync-after-swap', renderMode:'preview',
      trackVerification:'REQUIRED_SERVER_SIDE', authority:'INTAKE_ONLY',
      executionAuthority:'NONE', publicationAuthority:'NONE', costAuthority:'NONE',
    }
    const blob = new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href=url
    anchor.download='director-recast-PENDING-VERIFICATION.json'
    anchor.click()
    window.setTimeout(()=>URL.revokeObjectURL(url),3000)
    setPrepared(true)
  }

  return <section className="rounded-xl border bg-background p-4 space-y-3" id="director-recast">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">Director Casting Room / Recast</p>
    <h2 className="text-lg font-semibold">Character-only Recast · source audio lip-sync · preview</h2>
    <p className="text-sm text-muted-foreground">Planning intake only. Preserve the original scene, camera, orientation, lighting and movement. A server-verified approved track resolver and approved render worker are not yet commissioned. Entries cannot authorize a render.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        ['Original video asset ID',video,setVideo],
        ['Replacement character image asset ID',image,setImage],
        ['Original audio asset ID',audio,setAudio],
        ['Tracking artifact ID',tracking,setTracking],
        ['Approved character track ID',characterTrack,setCharacterTrack],
        ['Approved voice track ID',voiceTrack,setVoiceTrack],
        ['Character consent receipt ID',consent,setConsent],
        ['Media rights receipt ID',rights,setRights],
      ].map(([label,value,setter])=><label key={label as string} className="text-xs">{label as string}<input className="mt-1 w-full rounded border bg-background p-2 text-sm" value={value as string} onChange={event=>(setter as (x:string)=>void)(event.target.value)} /></label>)}
      <label className="text-xs">Clip duration (up to 30s)<input type="number" min={1} max={30} className="mt-1 w-full rounded border bg-background p-2 text-sm" value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label>
    </div>
    <button type="button" onClick={prepare} className="rounded border px-3 py-2 text-sm">Export unverified Recast intake</button>
    {error?<p role="status" className="text-xs text-muted-foreground">{error}. A verified Director tracking approval is required; entered IDs cannot grant approval.</p>:null}
    {prepared?<p role="status">Unverified intake JSON exported for review. No rendering or asset approval requested.</p>:null}
    <p className="text-xs text-muted-foreground">No footage upload or preview rendering is performed here. Do not provide private likeness footage without consent and proper rights.</p>
  </section>
}
