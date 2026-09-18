import {describe,expect,it,vi} from 'vitest'
import {createTrackingWorkerAdapter} from './studio-tracking-worker-adapter'
const request={sourceAssetId:'video',frameStart:0,frameEnd:10,classes:['character' as const]}
const track={trackId:'t',class:'character' as const,instanceId:'c',frameStart:0,frameEnd:10,annotations:[{frame:0,class:'character' as const,instanceId:'c',confidence:.9}],source:'model' as const,confidence:.9,approved:false}
describe('tracking worker adapter',()=>{
 it('maps a worker response without granting approval',async()=>{const post=vi.fn(async()=>({artifactId:'a',tracks:[track],segmentationRefs:['mask'],keypointRefs:['kp']}));const a=createTrackingWorkerAdapter({post});const out=await a.track(request);expect(out.tracks[0].approved).toBe(false);expect(out.provider).toBe('tracking-worker');expect(post).toHaveBeenCalledWith('/v1/track',expect.objectContaining({frameStart:0,frameEnd:10}))})
 it('rejects malformed worker output',async()=>{const a=createTrackingWorkerAdapter({post:vi.fn(async()=>({artifactId:'a',tracks:'bad'}))});await expect(a.track(request)).rejects.toThrow('invalid response')})
 it('rejects output outside the governed frame range',async()=>{const a=createTrackingWorkerAdapter({post:vi.fn(async()=>({artifactId:'a',tracks:[{...track,frameEnd:11}],segmentationRefs:[],keypointRefs:[]}))});await expect(a.track(request)).rejects.toThrow('exceeded governed frame range')})
})
