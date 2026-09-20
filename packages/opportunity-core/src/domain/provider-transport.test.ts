import assert from 'node:assert/strict'
import { transmitAuthorizedProviderPacket } from './provider-transport.js'

const packet={id:'packet:1',opportunityId:'sam:1',providerId:'provider:1',role:'lead',requirementIds:['r1'] as string[],evidenceRefs:['e1'] as string[],subject:'Request',draftBody:'Exploratory only',diligenceQuestions:[] as string[],negotiationPoints:[] as string[],commercialSummary:{structure:'direct_fulfillment',modeledGrossRevenue:100,modeledMarginPercent:20},approvalRef:'draft:approval',draftOnly:true,sendAuthorized:false,contractAuthorized:false} as const
const authorization={id:'send:1',packetId:'packet:1',opportunityId:'sam:1',providerId:'provider:1',channel:'email',destinationRef:'provider-contact:1',approvedByRef:'human:1',approvalRef:'send:approval',authorizedAt:'2026-09-20T00:00:00Z',expiresAt:'2026-09-22T00:00:00Z',scope:'single_send',contractAuthority:false} as const
{
 let sends=0
 const receipt=await transmitAuthorizedProviderPacket({packet,authorization,ledger:{opportunityId:'sam:1',providerId:'provider:1',events:[{id:'send:1:authorized',type:'send_authorized',opportunityId:'sam:1',providerId:'provider:1',packetId:'packet:1',authorizationId:'send:1',channel:'email',destinationRef:'provider-contact:1',actorRef:'human:1',occurredAt:'2026-09-20T00:00:00Z',notes:[]}]},transport:{id:'mock',async send(input){sends++;assert.equal(input.idempotencyKey,'send:1');return {externalMessageRef:'msg:1'}}},now:'2026-09-20T01:00:00Z'})
 assert.equal(sends,1);assert.equal(receipt.contractAuthority,false);assert.equal(receipt.bidSubmissionAuthority,false)
}
{
 await assert.rejects(()=>transmitAuthorizedProviderPacket({packet,authorization,ledger:{opportunityId:'sam:1',providerId:'provider:1',events:[]},transport:{id:'mock',async send(){return {externalMessageRef:'x'}}},now:'2026-09-20T01:00:00Z'}),/receipt/)
}
