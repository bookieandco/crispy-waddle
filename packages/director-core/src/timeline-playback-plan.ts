import type {EditableTimeline,TimelineClip} from './timeline-model.js'

export type DirectorPlaybackSegment=Readonly<{
  clipId:string
  assetId:string
  trackId:string
  kind:'video'|'audio'
  startSeconds:number
  endSeconds:number
  sourceInSeconds:number
  speed:number
  muted:boolean
  volume:number
}>

/** Playback is a projection of the persisted timeline, never a render or QC receipt. */
export function planDirectorPlayback(timeline:EditableTimeline):readonly DirectorPlaybackSegment[]{
  const segments:DirectorPlaybackSegment[]=[]
  if(!Number.isFinite(timeline.durationSeconds)||timeline.durationSeconds<=0){
    throw new Error('DIRECTOR_PLAYBACK_DURATION_INVALID')
  }
  for(const track of timeline.tracks){
    if(track.muted||track.hidden||!['video','audio'].includes(track.kind))continue
    for(const clip of track.clips){
      if(clip.muted)continue
      const start=clip.startSeconds
      const duration=clip.durationSeconds
      const sourceIn=clip.sourceInSeconds??0
      const speed=clip.speed??1
      if(!clip.assetId?.trim()||![start,duration,sourceIn,speed].every(Number.isFinite)||
         start<0||duration<=0||sourceIn<0||speed<=0||clip.reverse===true){
        throw new Error('DIRECTOR_PLAYBACK_CLIP_UNSUPPORTED:'+clip.id)
      }
      const end=Math.min(timeline.durationSeconds,start+duration)
      if(end<=start)continue
      segments.push(Object.freeze({
        clipId:clip.id,assetId:clip.assetId,trackId:track.id,
        kind:track.kind as 'video'|'audio',
        startSeconds:start,endSeconds:end,sourceInSeconds:sourceIn,
        speed,muted:false,volume:Math.max(0,Math.min(1,clip.volume??1)),
      }))
    }
  }
  return Object.freeze(segments.sort((a,b)=>a.startSeconds-b.startSeconds||
    a.trackId.localeCompare(b.trackId)||a.clipId.localeCompare(b.clipId)))
}
export function directorPlaybackSourceTime(clip:DirectorPlaybackSegment,playheadSeconds:number):number{
  return clip.sourceInSeconds+(Math.max(0,playheadSeconds-clip.startSeconds)*clip.speed)
}
