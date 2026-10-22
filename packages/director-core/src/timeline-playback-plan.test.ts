import {describe,expect,it} from 'vitest'
import type {EditableTimeline,TimelineClip} from './timeline-model'
import {planDirectorPlayback,directorPlaybackSourceTime} from './timeline-playback-plan'
const clip:TimelineClip={id:'v1',assetId:'a1',trackId:'v',startSeconds:2,durationSeconds:4,
 sourceInSeconds:1,speed:1.5,effects:[],generativeRegions:[]}
const timeline:EditableTimeline={version:1,projectId:'p',fps:30,width:1080,height:1920,
 durationSeconds:10,playheadSeconds:0,tracks:[{id:'v',name:'video',kind:'video',index:0,clips:[clip]}],
 transitions:[],markers:[],versions:[]}
describe('Director synchronized playback plan',()=>{
 it('preserves source trims and rate with timeline offsets',()=>{
   const segments=planDirectorPlayback(timeline)
   expect(segments).toHaveLength(1)
   expect(segments[0]).toMatchObject({startSeconds:2,endSeconds:6,sourceInSeconds:1,speed:1.5})
   expect(directorPlaybackSourceTime(segments[0]!,4)).toBe(4)
 })
 it('ignores muted tracks, caps clip bounds and never claims final media',()=>{
   expect(planDirectorPlayback({...timeline,durationSeconds:4})[0]!.endSeconds).toBe(4)
   expect(planDirectorPlayback({...timeline,tracks:[{...timeline.tracks[0]!,muted:true}]})).toHaveLength(0)
 })
 it('rejects reverse and malformed clip timing rather than silently desyncing',()=>{
   expect(()=>planDirectorPlayback({...timeline,tracks:[{...timeline.tracks[0]!,
      clips:[{...clip,reverse:true}]}]})).toThrow('DIRECTOR_PLAYBACK_CLIP_UNSUPPORTED')
   expect(()=>planDirectorPlayback({...timeline,tracks:[{...timeline.tracks[0]!,
      clips:[{...clip,durationSeconds:Number.NaN}]}]})).toThrow()
 })
})
