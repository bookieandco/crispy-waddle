import { describe,expect,it,vi } from 'vitest'
import { executeAuthorizedSamProviderSend } from './sam-outbound-execution'
describe('SAM outbound execution boundary',()=>{
 it('fails before transport without active authorization',async()=>{
  const send=vi.fn()
  await expect(executeAuthorizedSamProviderSend({
    packet:{id:'p',opportunityId:'sam:1',providerId:'v',role:'lead',subject:'s',purpose:'p',scopeSummary:[],requirementIds:[],evidenceRefs:[],questions:[],proposedNextStep:'next',approvalRef:'draft',draftOnly:true,sendAuthorized:false} as never,
    authorization:{id:'a',packetId:'wrong',opportunityId:'sam:1',providerId:'v',channel:'email',destinationRef:'x',approvedByRef:'human',approvalRef:'send',authorizedAt:'2026-09-20T00:00:00Z',scope:'single_send',contractAuthority:false},
    ledger:{opportunityId:'sam:1',providerId:'v',events:[]},actorRef:'human',now:'2026-09-20T00:01:00Z',
  },{send})).rejects.toThrow(/Active single-send authorization/)
  expect(send).not.toHaveBeenCalled()
 })
})
