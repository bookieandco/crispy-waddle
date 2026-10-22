import type {EditableTimeline} from './timeline-model.js'
import {planDirectorPlayback} from './timeline-playback-plan.js'

export type DirectorApprovedSource=Readonly<{
  assetId:string
  objectPath:string
  sha256:string
  mediaType:'video'|'audio'
}>
export type DirectorOfflineRenderPlan=Readonly<{
  schemaVersion:1
  authority:'DIRECTOR_OFFLINE_RENDER_PLAN_ONLY'
  projectId:string
  timelineRevision:number
  timelineVersionId:string
  durationSeconds:number
  fps:number
  width:number
  height:number
  outputContainer:'mp4'
  sources:readonly DirectorApprovedSource[]
  clips:readonly Readonly<{
    clipId:string;trackId:string;kind:'video'|'audio';assetId:string
    startSeconds:number;durationSeconds:number;sourceInSeconds:number;volume:number
  }>[]
  canPublish:false
  qcCertified:false
}>

const SHA=/^(?:sha256:)?[a-f0-9]{64}$/i
export function buildDirectorOfflineRenderPlan(
 timeline:EditableTimeline,revision:number,sources:readonly DirectorApprovedSource[],
):DirectorOfflineRenderPlan{
 if(!Number.isSafeInteger(revision)||revision<1||!timeline.projectId.trim()||
 !Number.isFinite(timeline.durationSeconds)||timeline.durationSeconds<1||timeline.durationSeconds>120||
 !Number.isSafeInteger(timeline.fps)||timeline.fps<24||timeline.fps>60||
 !Number.isSafeInteger(timeline.width)||!Number.isSafeInteger(timeline.height)||
 timeline.width<16||timeline.height<16||timeline.width*timeline.height>4_000_000||
 timeline.width%2!==0||timeline.height%2!==0)
  throw new Error('DIRECTOR_FINAL_RENDER_GEOMETRY_OR_DURATION_INVALID')
 if(timeline.transitions.length)throw new Error('DIRECTOR_FINAL_RENDER_TRANSITIONS_REQUIRE_SUPPORTED_WORKER')
 const clips=timeline.tracks.flatMap(track=>track.clips.map(clip=>({track,clip})))
 for(const {track,clip} of clips){
  if(track.hidden||track.muted||clip.muted)continue
  if(!['video','audio'].includes(track.kind)||clip.reverse||
   clip.speed!==undefined&&clip.speed!==1||
   clip.opacity!==undefined&&clip.opacity!==1||
   clip.effects.length>0||clip.generativeRegions.length>0||
   clip.keyframes?.length||clip.crop||clip.transform||clip.blendMode&&clip.blendMode!=='normal'){
   throw new Error('DIRECTOR_FINAL_RENDER_UNSUPPORTED_EDIT:'+clip.id)
  }
 }
 const planned=planDirectorPlayback(timeline)
 const video=planned.filter(x=>x.kind==='video').sort((a,b)=>a.startSeconds-b.startSeconds)
 if(!video.length)throw new Error('DIRECTOR_FINAL_RENDER_VIDEO_REQUIRED')
 for(let i=1;i<video.length;i++){
   if(video[i]!.startSeconds<video[i-1]!.endSeconds-0.001)
    throw new Error('DIRECTOR_FINAL_RENDER_OVERLAPPING_VIDEO_UNSUPPORTED')
 }
 const byId=new Map(sources.map(source=>[source.assetId,source]))
 const includedIds=[...new Set(planned.map(segment=>segment.assetId))]
 for(const id of includedIds){
   const source=byId.get(id)
   if(!source||!SHA.test(source.sha256)||
     !source.objectPath||source.objectPath.startsWith('/')||
     source.objectPath.split('/').some(part=>!part||part==='.'||part==='..')||
     source.objectPath.includes('\\')||source.objectPath.includes('?')||source.objectPath.includes('#')){
     throw new Error('DIRECTOR_FINAL_RENDER_SOURCE_NOT_ADMITTED:'+id)
   }
   if(planned.some(clip=>clip.assetId===id&&clip.kind!==source.mediaType))
     throw new Error('DIRECTOR_FINAL_RENDER_SOURCE_MEDIA_KIND_MISMATCH:'+id)
 }
 return Object.freeze({
   schemaVersion:1 as const,authority:'DIRECTOR_OFFLINE_RENDER_PLAN_ONLY' as const,
   projectId:timeline.projectId,timelineRevision:revision,
   timelineVersionId:timeline.versions.at(-1)?.id??'initial:'+revision,
   durationSeconds:timeline.durationSeconds,fps:timeline.fps,width:timeline.width,height:timeline.height,
   outputContainer:'mp4' as const,
   sources:Object.freeze(includedIds.map(id=>byId.get(id)!)),
   clips:Object.freeze(planned.map(segment=>({
     clipId:segment.clipId,trackId:segment.trackId,kind:segment.kind,assetId:segment.assetId,
     startSeconds:segment.startSeconds,durationSeconds:segment.endSeconds-segment.startSeconds,
     sourceInSeconds:segment.sourceInSeconds,volume:segment.volume,
   }))),
   canPublish:false as const,qcCertified:false as const,
 })
}
