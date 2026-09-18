import { describe, expect, it, vi } from 'vitest'
import { createCharacterReplacementProvider, validateCharacterReplacementInput } from './studio-character-replacement'
import { createDirectorStudioAction } from './studio-governed-action'

const approvedTrack={trackId:'t1',class:'character' as const,instanceId:'actor',frameStart:0,frameEnd:20,annotations:[{frame:0,class:'character' as const,instanceId:'actor',confidence:.95,maskRef:'mask'}],source:'hybrid' as const,confidence:.95,approved:true}

describe('Director Studio character replacement',()=>{
  it('rejects unapproved model tracking before compositing',()=>{
    expect(validateCharacterReplacementInput({sourceAssetId:'video',replacementAssetId:'muppet',trackingArtifactId:'tracking',tracks:[{...approvedTrack,approved:false}],preserveMotion:true,preserveLighting:true})).toContain('all replacement tracks must be approved')
  })
  it('preserves motion and lighting by default and carries continuity evidence',async()=>{
    const composite=vi.fn(async(input:any)=>({artifactId:'composite-1',sourceAssetId:input.sourceAssetId,replacementAssetId:input.replacementAssetId,trackingArtifactId:input.trackingArtifactId,provider:'test-compositor',compositeEvidenceIds:['qc-mask-edge'],continuityRef:input.continuityRef}))
    const provider=createCharacterReplacementProvider({name:'test',composite})
    const request=createDirectorStudioAction({id:'a',userId:'u',requestedAt:'now',projectId:'p',capability:'character-replace',inputAssetIds:['video','muppet'],parameters:{trackingArtifactId:'tracking-1',tracks:[approvedTrack],continuityRef:'character-dna:c1'}})
    const result=await provider.execute(request.action,request)
    expect(composite).toHaveBeenCalledWith(expect.objectContaining({preserveMotion:true,preserveLighting:true}))
    expect(result.outputAssetIds).toEqual(['composite-1'])
    expect(result.evidenceIds).toContain('continuity:character-dna:c1')
  })
  it('fails closed without a replacement identity asset',async()=>{
    const composite=vi.fn()
    const provider=createCharacterReplacementProvider({name:'test',composite})
    const request=createDirectorStudioAction({id:'a',userId:'u',requestedAt:'now',projectId:'p',capability:'character-replace',inputAssetIds:['video'],parameters:{trackingArtifactId:'tracking',tracks:[approvedTrack]}})
    await expect(provider.execute(request.action,request)).rejects.toThrow('replacementAssetId is required')
    expect(composite).not.toHaveBeenCalled()
  })
})
