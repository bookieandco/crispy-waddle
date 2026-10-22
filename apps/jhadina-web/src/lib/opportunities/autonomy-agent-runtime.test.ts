import { describe, expect, it } from 'vitest'
import { InMemoryAgentRuntimeRepository } from '@jhadina/agent-runtime-core'
import type { Opportunity } from '@jhadina/opportunity-core'
import { assertOwnerScopedPilotRunId, readOwnerPilotRun, runSourceBoundOpportunityPilot } from './autonomy-agent-runtime'
const owner='123e4567-e89b-42d3-a456-426614174000'
const now='2026-10-22T07:00:00.000Z'
const canonical:Opportunity={
  id:'o:research',title:'Research service',family:'business',type:'commercial',
  sourceName:'Fixture',sourceUrl:'https://a.example/1',
  claims:[],evidence:[
    {id:'e:a',sourceId:'sa',sourceUrl:'https://a.example/1',sourceName:'A',sourceType:'official',capturedAt:now,excerpt:'A supported fact',confidence:0.9},
    {id:'e:b',sourceId:'sb',sourceUrl:'https://b.example/2',sourceName:'B',sourceType:'official',capturedAt:now,excerpt:'B supported fact',confidence:0.9},
  ],verificationStatus:'unverified',sourceConfidence:0.9,riskFlags:[],status:'discovered',createdAt:now,updatedAt:now,
}
const observations=canonical.evidence.map((e,i)=>({id:'obs:'+i,opportunityId:canonical.id,sourceUrl:e.sourceUrl,evidenceId:e.id,excerpt:e.excerpt!,observedAt:now,reviewedByOwner:true}))
const pilot={kind:'research_report' as const,subject:'Research engagement',createdAt:'2026-10-22T07:01:00Z',evidence:observations.map(o=>({sourceUrl:o.sourceUrl,observedAt:o.observedAt,finding:o.excerpt}))}
describe('OCE canonical durable agent integration',()=>{
  it('persists an internal-only report run and terminal checkpoint',async()=>{
    const repository=new InMemoryAgentRuntimeRepository()
    const result=await runSourceBoundOpportunityPilot({ownerId:owner,opportunity:canonical,pilot,observations,repository,now:()=>now})
    expect(result.accepted).toBe(true)
    if(!result.runId)throw Error('missing runId')
    assertOwnerScopedPilotRunId(result.runId,owner)
    const run=await repository.getRun(result.runId)
    expect(run?.status).toBe('completed')
    const checkpoint=await repository.getLatestCheckpoint(result.runId)
    expect(checkpoint?.reason).toBe('terminal')
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.paidOutcomeVerified).toBe(false)
    expect(result.document).toContain('INTERNAL DRAFT')
  })
  it('recovers a hash-attested internal report after a simulated app restart',async()=>{
    const repository=new InMemoryAgentRuntimeRepository()
    const sourceReceipts=observations.map((o,i)=>({
      evidenceId:o.evidenceId,sourceUrl:o.sourceUrl,confirmedExcerpt:o.excerpt,
      contentSha256:String(i).repeat(64),observedAt:now,
      sourceType:'PUBLIC_SOURCE_CONTENT' as const,externalActionAuthorized:false as const,
    }))
    const result=await runSourceBoundOpportunityPilot({
      ownerId:owner,opportunity:canonical,pilot,observations,sourceReceipts,
      repository,now:()=>now,
    })
    expect(result.accepted).toBe(true)
    if(!result.runId)throw Error('missing run id')
    const recovered=await readOwnerPilotRun({ownerId:owner,runId:result.runId,repository})
    expect(recovered?.status).toBe('completed')
    expect(recovered?.result?.document).toEqual(result.document)
    expect(recovered?.result?.reportSha256).toEqual(result.reportSha256)
    expect(recovered?.result?.sourceHashes).toHaveLength(2)
    expect(recovered?.result?.customerDeliveryAuthorized).toBe(false)
    await expect(readOwnerPilotRun({ownerId:'765e4544-9382-47c7-8dce-27ce09acdd70',runId:result.runId,repository})).rejects.toThrow(/OWNER_SCOPE/)
  })
  it('blocks forged or mismatched source receipts before an agent run starts',async()=>{
    const repository=new InMemoryAgentRuntimeRepository()
    await expect(runSourceBoundOpportunityPilot({
      ownerId:owner,opportunity:canonical,pilot,observations,
      sourceReceipts:[{evidenceId:'e:a',sourceUrl:'https://a.example/1',confirmedExcerpt:'A supported fact',
        contentSha256:'not-a-hash',observedAt:now,sourceType:'PUBLIC_SOURCE_CONTENT',
        externalActionAuthorized:false}],
      repository,
    })).rejects.toThrow(/Source hash receipts/)
  })
  it('rejects unaudited claims without constructing an agent run',async()=>{
    const repository=new InMemoryAgentRuntimeRepository()
    const result=await runSourceBoundOpportunityPilot({ownerId:owner,opportunity:canonical,pilot,observations:[{...observations[0],reviewedByOwner:false},observations[1]],repository})
    expect(result.accepted).toBe(false)
    expect(result.runId).toBeNull()
  })
  it('rejects attempted cross-owner reading',()=>{
    expect(()=>assertOwnerScopedPilotRunId('agent-run:oce:'+owner+':0f718f35-7e73-41a6-9232-15225878d727','765e4544-9382-47c7-8dce-27ce09acdd70')).toThrow(/OWNER_SCOPE/)
    expect(()=>assertOwnerScopedPilotRunId('some-unrelated-agent-run',owner)).toThrow(/OWNER_SCOPE/)
  })
})
