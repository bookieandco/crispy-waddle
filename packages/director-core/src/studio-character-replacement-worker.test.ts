import {describe,expect,it,vi} from 'vitest'
import {createCharacterReplacementWorkerAdapter} from './studio-character-replacement-worker'

const track={trackId:'t',class:'character' as const,instanceId:'c',frameStart:0,frameEnd:2,annotations:[],source:'human' as const,confidence:1,approved:true}
const input={
 sourceAssetId:'source',
 replacementAssetId:'muppet',
 trackingArtifactId:'sam2:a',
 tracks:[track],
 preserveMotion:true,
 preserveFacialMotion:true,
 preserveLighting:true,
 preserveOrientation:true,
 environmentMode:'reference-frame' as const,
 environmentReferenceAssetId:'frame:bg',
 motionReferenceAssetId:'source',
 sourceDimensions:{width:1080,height:1920},
 replacementDimensions:{width:1080,height:1920},
 aspectRatioPolicy:'strict-match' as const,
 continuityRef:'dna:1',
}

function response(overrides:Record<string,unknown>={}) {
 return {
  artifactId:'composite',
  trackingArtifactId:'sam2:a',
  compositeEvidenceIds:['edge-qc','motion-qc','face-motion-qc','background-qc'],
  continuityRef:'dna:1',
  motionReferenceAssetId:'source',
  environmentMode:'reference-frame',
  environmentReferenceAssetId:'frame:bg',
  ...overrides,
 }
}

describe('replacement worker adapter',()=>{
 it('passes approved tracking, motion, background and continuity lineage',async()=>{
  const post=vi.fn(async()=>response())
  const out=await createCharacterReplacementWorkerAdapter({post}).composite(input)
  expect(out.artifactId).toBe('composite')
  expect(post).toHaveBeenCalledWith('/v1/composite',expect.objectContaining({
   approvedTrackIds:['t'],
   replacementAssetId:'muppet',
   preserveFacialMotion:true,
   environmentMode:'reference-frame',
   environmentReferenceAssetId:'frame:bg',
   motionReferenceAssetId:'source',
  }))
 })
 it('rejects tracking evidence substitution',async()=>{
  const a=createCharacterReplacementWorkerAdapter({post:vi.fn(async()=>response({trackingArtifactId:'other'}))})
  await expect(a.composite(input)).rejects.toThrow('changed tracking evidence')
 })
 it('rejects motion reference substitution',async()=>{
  const a=createCharacterReplacementWorkerAdapter({post:vi.fn(async()=>response({motionReferenceAssetId:'other-video'}))})
  await expect(a.composite(input)).rejects.toThrow('changed motion reference')
 })
 it('rejects environment reference substitution',async()=>{
  const a=createCharacterReplacementWorkerAdapter({post:vi.fn(async()=>response({environmentReferenceAssetId:'frame:other'}))})
  await expect(a.composite(input)).rejects.toThrow('changed environment reference')
 })
})
