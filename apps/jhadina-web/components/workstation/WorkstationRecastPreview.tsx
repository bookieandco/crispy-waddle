'use client'

import { useState } from 'react'
import { prepareRecastPreview, type RecastPreviewRequest } from '@jhadina/director-core'

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
    try {
      // A local planning manifest is NOT canonical evidence or approval.
      // UI cannot assert that entered IDs correspond to real approved records.
      const request: RecastPreviewRequest = {
        id: crypto.randomUUID(), projectId, userId: 'UNVERIFIED_PREVIEW_OPERATOR',
        requestedAt: new Date().toISOString(),
        sourceVideoAssetId: video.trim(), characterImageAssetId: image.trim(),
        sourceAudioAssetId: audio.trim(), trackingArtifactId: tracking.trim(),
        approvedCharacterTracks: [{
          trackId: characterTrack.trim(), instanceId: 'PREVIEW_UNVERIFIED',
          class: 'character', frameStart: 0, frameEnd: 1,
          source: 'human', confidence: 0, approved: false, annotations: [],
        }],
        approvedVoiceTracks: [{
          trackId: voiceTrack.trim(), startMs: 0, endMs: 1000,
          source: 'human', confidence: 0, approved: false,
        }],
        sourceDurationSeconds: duration, consentReceiptId: consent.trim(),
        mediaRightsReceiptId: rights.trim(),
      }
      // Deliberately fails closed: approval-bearing tracks cannot be
      // self-certified in a client form. A real authenticated read-only
      // resolver must replace this before the Prepare action can succeed.
      prepareRecastPreview(request)
      setPrepared(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview plan blocked')
    }
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
    <button type="button" onClick={prepare} className="rounded border px-3 py-2 text-sm">Validate Recast intake</button>
    {error?<p role="status" className="text-xs text-muted-foreground">{error}. A verified Director tracking approval is required; entered IDs cannot grant approval.</p>:null}
    {prepared?<p role="status">Intake prepared for server-side approval validation. No rendering requested.</p>:null}
    <p className="text-xs text-muted-foreground">No footage upload or preview rendering is performed here. Do not provide private likeness footage without consent and proper rights.</p>
  </section>
}
