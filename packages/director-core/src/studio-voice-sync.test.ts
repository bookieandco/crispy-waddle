import { describe,expect,it,vi } from 'vitest'
import { createVoiceSyncProvider,validateVoiceSyncInput } from './studio-voice-sync'
import { createDirectorStudioAction } from './studio-governed-action'

const track={startMs:0,endMs:250,phoneme:'AH',viseme:'A',confidence:.9}

describe('Director Studio voice sync',()=>{
  it('rejects unusable timing evidence before provider execution',()=>{
    expect(validateVoiceSyncInput({videoAssetId:'v',audioAssetId:'a',mode:'lip-sync',tracks:[{...track,confidence:.2}]})).toContain('all voice-sync tracks must meet duration and confidence thresholds')
  })
  it('supports provider-neutral viseme synchronization with evidence',async()=>{
    const synchronize=vi.fn(async()=>({artifactId:'sync-1',videoAssetId:'v',audioAssetId:'a',provider:'musetalk',syncEvidenceIds:['alignment-1'],averageConfidence:.91}))
    const provider=createVoiceSyncProvider({name:'musetalk',synchronize})
    const request=createDirectorStudioAction({id:'x',userId:'u',requestedAt:'now',projectId:'p',capability:'voice-sync',inputAssetIds:['v','a'],parameters:{mode:'viseme-driven',tracks:[track],characterTrackId:'muppet-1',continuityRef:'character-dna:c1'}})
    const result=await provider.execute(request.action,request)
    expect(result.outputAssetIds).toEqual(['sync-1'])
    expect(result.evidenceIds).toContain('voice-sync-mode:viseme-driven')
    expect(result.evidenceIds).toContain('character-track:muppet-1')
  })
  it('fails closed on low-confidence provider output',async()=>{
    const synchronize=vi.fn(async()=>({artifactId:'bad',videoAssetId:'v',audioAssetId:'a',provider:'test',syncEvidenceIds:[],averageConfidence:.4}))
    const provider=createVoiceSyncProvider({name:'test',synchronize})
    const request=createDirectorStudioAction({id:'x',userId:'u',requestedAt:'now',projectId:'p',capability:'voice-sync',inputAssetIds:['v','a'],parameters:{tracks:[track]}})
    await expect(provider.execute(request.action,request)).rejects.toThrow('below acceptance threshold')
  })
})
