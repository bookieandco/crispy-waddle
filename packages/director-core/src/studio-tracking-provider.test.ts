import { describe, expect, it, vi } from 'vitest'
import { createTrackingSegmentationProvider, validateTrackingRequest } from './studio-tracking-provider'
import { createDirectorStudioAction } from './studio-governed-action'

describe('Director Studio tracking + segmentation', () => {
  it('validates bounded tracking work before a model adapter is called', () => {
    expect(validateTrackingRequest({sourceAssetId:'',frameStart:-1,frameEnd:-2,classes:[]})).toHaveLength(4)
  })
  it('maps tracking artifacts into approval-gated Studio outputs and evidence', async () => {
    const track=vi.fn(async()=>({artifactId:'tracking-1',sourceAssetId:'video',provider:'sam2',segmentationRefs:['mask-1'],keypointRefs:['kp-1'],tracks:[{trackId:'t1',class:'character' as const,instanceId:'c1',frameStart:0,frameEnd:20,annotations:[{frame:0,class:'character' as const,instanceId:'c1',confidence:.9,maskRef:'mask-1'}],source:'model' as const,confidence:.9,approved:false}]}))
    const provider=createTrackingSegmentationProvider({name:'sam2',track})
    const request=createDirectorStudioAction({id:'a',userId:'u',requestedAt:'now',projectId:'p',capability:'tracking',inputAssetIds:['video'],parameters:{frameStart:0,frameEnd:20,classes:['character']}})
    const result=await provider.execute(request.action,request)
    expect(result.outputAssetIds).toEqual(['tracking-1'])
    expect(result.evidenceIds).toContain('mask-1')
    expect(result.evidenceIds).toContain('tracking-unapproved:1')
  })
  it('fails closed on malformed action parameters without calling the adapter', async () => {
    const track=vi.fn()
    const provider=createTrackingSegmentationProvider({name:'test',track})
    const request=createDirectorStudioAction({id:'a',userId:'u',requestedAt:'now',projectId:'p',capability:'tracking',inputAssetIds:['video']})
    await expect(provider.execute(request.action,request)).rejects.toThrow('Invalid tracking request')
    expect(track).not.toHaveBeenCalled()
  })
})
