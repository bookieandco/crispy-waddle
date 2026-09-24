import {describe,expect,it,vi} from 'vitest'
import {createRigAnimationProvider,validateRigAnimationInput} from './studio-rig-animation'
import {createDirectorStudioAction} from './studio-governed-action'
const track={trackId:'t',class:'character' as const,instanceId:'c',frameStart:0,frameEnd:24,annotations:[{frame:0,class:'character' as const,instanceId:'c',confidence:.9,keypoints:[{name:'head',x:.5,y:.2,confidence:.9}]}],source:'hybrid' as const,confidence:.9,approved:true}
describe('Director Studio rig animation',()=>{
 it('requires approved tracking and channels',()=>{expect(validateRigAnimationInput({characterAssetId:'c',trackingArtifactId:'t',tracks:[{...track,approved:false}],channels:[]})).toEqual(expect.arrayContaining(['all rig source tracks must be approved','at least one rig channel is required']))})
 it('emits reusable rig and animation assets with continuity evidence',async()=>{
  const animate=vi.fn(async()=>({artifactId:'motion-1',rigAssetId:'rig-1',animationAssetId:'anim-1',provider:'rig-test',evidenceIds:['solve-1'],frameStart:0,frameEnd:24}))
  const provider=createRigAnimationProvider({name:'test',animate})
  const req=createDirectorStudioAction({id:'a',userId:'u',requestedAt:'now',projectId:'p',capability:'rig',inputAssetIds:['muppet'],parameters:{trackingArtifactId:'tracking-1',tracks:[track],channels:['body','head','face'],animationPlan:{version:1,narrativeGoal:'make the turn readable',primaryAction:'turn head',method:'pose-to-pose',poseHierarchy:{keys:['front','turn','settle']},timing:{fps:24,exposure:'twos'},evidenceRefs:['lesson:12-principles']},continuityRef:'character-dna:c1'}})
  const result=await provider.execute(req.action,req)
  expect(result.outputAssetIds).toEqual(['rig-1','anim-1','motion-1'])
  expect(result.evidenceIds).toContain('rig-channels:body,head,face')
  expect(result.evidenceIds).toContain('continuity:character-dna:c1')
  expect(result.evidenceIds).toContain('animation-method:pose-to-pose')
  expect(result.evidenceIds).toContain('lesson:12-principles')
 })
 it('rejects invalid governed animation principles before worker execution',()=>{expect(validateRigAnimationInput({characterAssetId:'c',trackingArtifactId:'t',tracks:[track],channels:['body'],animationPlan:{version:1,narrativeGoal:'bad squash',primaryAction:'bounce',method:'pose-to-pose',poseHierarchy:{keys:['up','down']},squashStretch:{amount:'strong',preserveVolume:false},timing:{fps:24,exposure:'twos'}}})).toContain('animation principle plan invalid: ANIMATION_SQUASH_VOLUME_REQUIRED')})
 it('fails closed on invalid output frame ranges',async()=>{
  const provider=createRigAnimationProvider({name:'bad',animate:vi.fn(async()=>({artifactId:'x',rigAssetId:'r',animationAssetId:'a',provider:'bad',evidenceIds:[],frameStart:9,frameEnd:2}))})
  const req=createDirectorStudioAction({id:'a',userId:'u',requestedAt:'now',projectId:'p',capability:'rig',inputAssetIds:['muppet'],parameters:{trackingArtifactId:'tracking',tracks:[track],channels:['body']}})
  await expect(provider.execute(req.action,req)).rejects.toThrow('invalid frame range')
 })
})
