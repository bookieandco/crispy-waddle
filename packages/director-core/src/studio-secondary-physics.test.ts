import {describe,expect,it,vi} from 'vitest'
import {createSecondaryPhysicsProvider,validateSecondaryPhysicsInput} from './studio-secondary-physics'
import {createDirectorStudioAction} from './studio-governed-action'
const layer={id:'fur',material:'fur' as const,attachment:'body',stiffness:.25,damping:.6,gravityScale:.8}
describe('Director Studio secondary physics',()=>{
 it('validates bounded material parameters',()=>{expect(validateSecondaryPhysicsInput({characterAssetId:'c',rigAssetId:'r',animationAssetId:'a',layers:[{...layer,stiffness:2}],frameStart:0,frameEnd:10})).toContain('stiffness and damping must be between 0 and 1')})
 it('carries puppet material and continuity evidence',async()=>{
  const simulate=vi.fn(async()=>({artifactId:'sim-evidence',simulatedAnimationAssetId:'sim-anim',provider:'physics-test',evidenceIds:['cache-1'],frameStart:0,frameEnd:24}))
  const provider=createSecondaryPhysicsProvider({name:'test',simulate})
  const req=createDirectorStudioAction({id:'a',userId:'u',requestedAt:'now',projectId:'p',capability:'physics',inputAssetIds:['muppet','rig','anim'],parameters:{layers:[{...layer,material:'puppet-fabric'}],frameStart:0,frameEnd:24,continuityRef:'character-dna:c1'}})
  const result=await provider.execute(req.action,req)
  expect(result.outputAssetIds).toEqual(['sim-anim','sim-evidence'])
  expect(result.evidenceIds).toContain('physics-layer:fur:puppet-fabric:body')
  expect(result.evidenceIds).toContain('continuity:character-dna:c1')
 })
 it('fails closed when simulation changes the governed frame range',async()=>{
  const provider=createSecondaryPhysicsProvider({name:'bad',simulate:vi.fn(async()=>({artifactId:'x',simulatedAnimationAssetId:'s',provider:'bad',evidenceIds:[],frameStart:1,frameEnd:9}))})
  const req=createDirectorStudioAction({id:'a',userId:'u',requestedAt:'now',projectId:'p',capability:'physics',inputAssetIds:['c','r','a'],parameters:{layers:[layer],frameStart:0,frameEnd:10}})
  await expect(provider.execute(req.action,req)).rejects.toThrow('does not match governed input')
 })
})
