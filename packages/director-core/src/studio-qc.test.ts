import {describe,expect,it,vi} from 'vitest'
import {createStudioQCProvider,decideStudioQC} from './studio-qc'
import {createDirectorStudioAction} from './studio-governed-action'
const input={assetId:'shot',requiredChecks:['tracking','voice-sync'] as const,evidenceIds:['upstream'],minimumScore:.8}
describe('Director Studio QC',()=>{
 it('fails missing required metrics rather than treating absence as success',()=>{const d=decideStudioQC({...input,requiredChecks:[...input.requiredChecks]},{reportId:'r',provider:'p',metrics:[{check:'tracking',score:.9,evidenceIds:[]}],evidenceIds:[]});expect(d.passed).toBe(false);expect(d.failedChecks).toContain('voice-sync')})
 it('passes complete evidence and emits a QC report receipt',async()=>{
  const inspect=vi.fn(async()=>({reportId:'report-1',provider:'qc-test',metrics:[{check:'tracking' as const,score:.95,evidenceIds:['track-qc']},{check:'voice-sync' as const,score:.9,evidenceIds:['sync-qc']}],evidenceIds:['frame-qc']}))
  const provider=createStudioQCProvider({name:'test',inspect})
  const req=createDirectorStudioAction({id:'q',userId:'u',requestedAt:'now',projectId:'p',capability:'qc',inputAssetIds:['shot'],parameters:{requiredChecks:['tracking','voice-sync'],evidenceIds:['upstream'],minimumScore:.8}})
  const result=await provider.execute(req.action,req);expect(result.outputAssetIds).toEqual(['shot']);expect(result.evidenceIds).toContain('qc-report:report-1');expect(result.evidenceIds).toContain('sync-qc')
 })
 it('blocks the asset when any required quality dimension misses threshold',async()=>{
  const provider=createStudioQCProvider({name:'test',inspect:vi.fn(async()=>({reportId:'r',provider:'p',metrics:[{check:'tracking' as const,score:.9,evidenceIds:[]},{check:'voice-sync' as const,score:.5,evidenceIds:[]}],evidenceIds:[]}))})
  const req=createDirectorStudioAction({id:'q',userId:'u',requestedAt:'now',projectId:'p',capability:'qc',inputAssetIds:['shot'],parameters:{requiredChecks:['tracking','voice-sync'],evidenceIds:['upstream'],minimumScore:.8}})
  await expect(provider.execute(req.action,req)).rejects.toThrow('voice-sync')
 })
})
