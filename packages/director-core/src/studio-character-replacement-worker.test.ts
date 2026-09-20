import {describe,expect,it,vi} from 'vitest'
import {createCharacterReplacementWorkerAdapter} from './studio-character-replacement-worker'
const track={trackId:'t',class:'character' as const,instanceId:'c',frameStart:0,frameEnd:2,annotations:[],source:'human' as const,confidence:1,approved:true}
const input={sourceAssetId:'source',replacementAssetId:'muppet',trackingArtifactId:'sam2:a',tracks:[track],preserveMotion:true,preserveLighting:true,continuityRef:'dna:1'}
describe('replacement worker adapter',()=>{
 it('passes approved tracking evidence and continuity',async()=>{const post=vi.fn(async()=>({artifactId:'composite',trackingArtifactId:'sam2:a',compositeEvidenceIds:['edge-qc'],continuityRef:'dna:1'}));const out=await createCharacterReplacementWorkerAdapter({post}).composite(input);expect(out.artifactId).toBe('composite');expect(post).toHaveBeenCalledWith('/v1/composite',expect.objectContaining({approvedTrackIds:['t'],replacementAssetId:'muppet'}))})
 it('rejects tracking evidence substitution',async()=>{const a=createCharacterReplacementWorkerAdapter({post:vi.fn(async()=>({artifactId:'x',trackingArtifactId:'other',compositeEvidenceIds:[],continuityRef:'dna:1'}))});await expect(a.composite(input)).rejects.toThrow('changed tracking evidence')})
})
