import type { FrameAnnotation, VideoTrack } from './studio-contracts'
import type { TrackingSegmentationAdapter, TrackingSegmentationArtifact, TrackingSegmentationRequest } from './studio-tracking-provider'

export interface TrackingWorkerClient {
  post(path:string, body:unknown):Promise<unknown>
}
type WorkerResponse={artifactId:string;tracks:VideoTrack[];segmentationRefs:string[];keypointRefs:string[]}

function isAnnotation(value:unknown):value is FrameAnnotation{
  if(!value||typeof value!=='object') return false
  const a=value as Record<string,unknown>
  return Number.isInteger(a.frame)&&typeof a.class==='string'&&typeof a.instanceId==='string'&&typeof a.confidence==='number'
}
function isTrack(value:unknown):value is VideoTrack{
  if(!value||typeof value!=='object') return false
  const t=value as Record<string,unknown>
  return typeof t.trackId==='string'&&typeof t.instanceId==='string'&&typeof t.class==='string'&&
    Number.isInteger(t.frameStart)&&Number.isInteger(t.frameEnd)&&Array.isArray(t.annotations)&&
    t.annotations.every(isAnnotation)&&typeof t.confidence==='number'&&typeof t.approved==='boolean'
}
function parseWorkerResponse(value:unknown):WorkerResponse{
  if(!value||typeof value!=='object') throw new Error('Tracking worker returned invalid response')
  const r=value as Record<string,unknown>
  if(typeof r.artifactId!=='string'||!Array.isArray(r.tracks)||!r.tracks.every(isTrack)||
     !Array.isArray(r.segmentationRefs)||!r.segmentationRefs.every(x=>typeof x==='string')||
     !Array.isArray(r.keypointRefs)||!r.keypointRefs.every(x=>typeof x==='string'))
    throw new Error('Tracking worker returned invalid response')
  return r as unknown as WorkerResponse
}
/**
 * Concrete transport adapter for a sandboxed tracking/segmentation worker.
 * The worker receives bounded media work only; authorization remains upstream.
 */
export function createTrackingWorkerAdapter(client:TrackingWorkerClient,endpoint='/v1/track'):TrackingSegmentationAdapter{
 return {
  name:'tracking-worker',
  async track(request:TrackingSegmentationRequest):Promise<TrackingSegmentationArtifact>{
   const response=parseWorkerResponse(await client.post(endpoint,{
    sourceAssetId:request.sourceAssetId,frameStart:request.frameStart,frameEnd:request.frameEnd,
    classes:request.classes,seedAnnotations:request.seedAnnotations??[],
   }))
   for(const track of response.tracks){
    if(track.frameStart<request.frameStart||track.frameEnd>request.frameEnd) throw new Error('Tracking worker exceeded governed frame range')
    if(!request.classes.includes(track.class)) throw new Error('Tracking worker returned unrequested class')
   }
   return {...response,sourceAssetId:request.sourceAssetId,provider:'tracking-worker'}
  },
 }
}
