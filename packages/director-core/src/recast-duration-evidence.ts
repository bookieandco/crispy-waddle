/**
 * Trusted ffprobe-side metadata arrives with the measured source hash.
 * Declared browser duration is never proof, and a missing stream blocks
 * preview-admission even when a local file looks like a video by MIME type.
 */
export interface RecastMediaProbeResult {
  projectId:string
  sourceVideoAssetId:string
  sourceVideoSha256:string
  durationSeconds:number
  hasVideoStream:boolean
  hasAudioStream:boolean
  frameWidth:number
  frameHeight:number
  probeVersion:'recast-ffprobe-v1'
  measuredBy:'trusted-local-media-probe'
  evidenceSha256:string
}
export interface RecastDurationDecision {
  verified:boolean
  measuredDurationSeconds:number|null
  blockers:readonly string[]
  renderAllowed:false
}
export function verifyRecastDuration(
  probe:RecastMediaProbeResult|null,
  request:Readonly<{projectId:string;sourceVideoAssetId:string;sourceVideoSha256:string;declaredDurationSeconds:number}>,
):RecastDurationDecision {
  const blockers:string[]=[]
  if(!probe||probe.probeVersion!=='recast-ffprobe-v1'||
    probe.measuredBy!=='trusted-local-media-probe'||
    probe.projectId!==request.projectId||
    probe.sourceVideoAssetId!==request.sourceVideoAssetId||
    probe.sourceVideoSha256.toLowerCase()!==request.sourceVideoSha256.toLowerCase()||
    !/^[a-f0-9]{64}$/i.test(probe.sourceVideoSha256)||
    !/^[a-f0-9]{64}$/i.test(probe.evidenceSha256))blockers.push('DIRECTOR_RECAST_TRUSTED_PROBE_REQUIRED')
  if(!probe||!probe.hasVideoStream||!Number.isInteger(probe.frameWidth)||
    !Number.isInteger(probe.frameHeight)||probe.frameWidth<32||probe.frameHeight<32)
    blockers.push('DIRECTOR_RECAST_DECODED_VIDEO_STREAM_REQUIRED')
  if(!probe||!Number.isFinite(probe.durationSeconds)||
    probe.durationSeconds<=0||probe.durationSeconds>30)
    blockers.push('DIRECTOR_RECAST_SOURCE_DURATION_OUT_OF_SCOPE')
  if(!Number.isFinite(request.declaredDurationSeconds)||
    request.declaredDurationSeconds<=0||
    !probe||Math.abs(probe.durationSeconds-request.declaredDurationSeconds)>0.25)
    blockers.push('DIRECTOR_RECAST_DECLARED_DURATION_MISMATCH')
  return Object.freeze({
    verified:blockers.length===0,
    measuredDurationSeconds:blockers.length===0?probe!.durationSeconds:null,
    blockers:Object.freeze(blockers),
    renderAllowed:false,
  })
}
