import {describe,expect,it} from 'vitest'
import type {EditableTimeline} from './timeline-model'
import {buildDirectorOfflineRenderPlan} from './offline-final-render-plan'
const hash='a'.repeat(64)
const timeline:EditableTimeline={
 version:1,projectId:'owned-project',fps:30,width:1080,height:1920,durationSeconds:12,
 playheadSeconds:0,
 tracks:[{id:'v',name:'Video',index:0,kind:'video',clips:[{
  id:'clip-1',assetId:'asset-a',trackId:'v',startSeconds:0,durationSeconds:12,
  effects:[],generativeRegions:[],
 }]}],markers:[],transitions:[],versions:[],
}
const assets=[{assetId:'asset-a',objectPath:'project/clip.mp4',sha256:hash,mediaType:'video' as const}]
describe('Director genuine offline final render boundary',()=>{
 it('prepares a 12-second 9:16 original pilot but certifies neither render nor publication',()=>{
  const plan=buildDirectorOfflineRenderPlan(timeline,1,assets)
  expect(plan).toMatchObject({durationSeconds:12,height:1920,outputContainer:'mp4',
   timelineRevision:1,canPublish:false,qcCertified:false})
  expect(plan.clips[0]).toMatchObject({assetId:'asset-a',durationSeconds:12})
 })
 it('rejects transitions and unsupported edits instead of silently flattening them',()=>{
  expect(()=>buildDirectorOfflineRenderPlan({...timeline,transitions:[{
   id:'t',fromClipId:'a',toClipId:'b',type:'cross-dissolve',durationSeconds:1
  }]},1,assets)).toThrow('TRANSITIONS_REQUIRE_SUPPORTED_WORKER')
  const bad={...timeline,tracks:[{...timeline.tracks[0]!,clips:[{
   ...timeline.tracks[0]!.clips[0]!,reverse:true
  }]}]}
  expect(()=>buildDirectorOfflineRenderPlan(bad,1,assets)).toThrow('UNSUPPORTED_EDIT')
 })
 it('rejects overlap, unknown assets, path escapes and invalid digest',()=>{
  const overlap={...timeline,tracks:[{...timeline.tracks[0]!,clips:[
   timeline.tracks[0]!.clips[0]!,{...timeline.tracks[0]!.clips[0]!,
    id:'two',startSeconds:2,durationSeconds:3}]}]}
  expect(()=>buildDirectorOfflineRenderPlan(overlap,1,assets)).toThrow('OVERLAPPING_VIDEO_UNSUPPORTED')
  expect(()=>buildDirectorOfflineRenderPlan(timeline,1,[])).toThrow('SOURCE_NOT_ADMITTED')
  expect(()=>buildDirectorOfflineRenderPlan(timeline,1,[{...assets[0]!,objectPath:'../escape'}])).toThrow()
  expect(()=>buildDirectorOfflineRenderPlan(timeline,1,[{...assets[0]!,sha256:'faked'}])).toThrow()
 })
})
