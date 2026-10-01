import {strict as assert} from 'node:assert'
import test from 'node:test'
import {
  DEFAULT_RELATIONSHIP_PIPELINES,
  buildSafeRelationshipWork,
  chooseCanonicalOrganizationId,
  deriveRelationshipIntelligence,
  fuseRelationshipContext,
  normalizeRelationshipIdentity,
  projectSamPrimeEvent,
  recommendedPipelineStage,
} from './production.js'

const NOW='2026-10-01T23:45:00.000Z'

test('CRM-PROD identity reconciliation prefers global durable identifiers',()=>{
  const a=chooseCanonicalOrganizationId({
    sourceNamespace:'sam',
    sourceId:'provider-a',
    identities:[{scheme:'uei',value:' abc123 ',evidenceRefs:['sam:1']}],
  })
  const b=chooseCanonicalOrganizationId({
    sourceNamespace:'public-prime',
    sourceId:'other-id',
    identities:[{scheme:'uei',value:'ABC123',evidenceRefs:['award:1']}],
  })
  assert.equal(a,b)
  assert.equal(normalizeRelationshipIdentity('domain',' EXAMPLE.COM '),'example.com')
})

test('CRM-PROD prime projection preserves evidence and analysis-only authority',()=>{
  const row=projectSamPrimeEvent({
    ownerUserId:'user:1',
    organizationId:'org:prime:1',
    displayName:'Prime One',
    event:{
      primeId:'org:prime:1',
      opportunityId:'opp:1',
      kind:'quote_submitted',
      occurredAt:NOW,
      evidenceRefs:['quote:1'],
      amount:12000,
      currency:'USD',
    },
  })
  assert.equal(row.role.role,'prime')
  assert.equal(row.contextLink.contextRef,'opp:1')
  assert.equal(row.activity.type,'sam.prime.quote_submitted')
  assert.equal(row.entity.authority,'RELATIONSHIP_INTELLIGENCE_ONLY')
})

test('CRM-PROD pipelines never treat prepared outreach as execution authority',()=>{
  const commercial=DEFAULT_RELATIONSHIP_PIPELINES.find(row=>row.pipeline.id==='commercial_prospecting')
  assert.ok(commercial)
  assert.equal(recommendedPipelineStage('commercial_prospecting','commercial.outreach_prepared'),'draft_ready')
  assert.equal(recommendedPipelineStage('commercial_prospecting','commercial.outreach_approval_required'),'approval_required')
  assert.equal(commercial?.pipeline.stages.some(row=>row.id==='contacted'),true)
})

test('CRM-PROD due work is fail-closed for execution',()=>{
  const work=buildSafeRelationshipWork({
    id:'work:1',
    ownerUserId:'user:1',
    entityId:'org:1',
    capability:'relationship.refresh_provider',
    reason:'Refresh provider capacity evidence.',
    dueAt:NOW,
    correlationId:'corr:1',
    evidenceRefs:['sam:1'],
  })
  assert.equal(work.executionAuthorized,false)
  assert.equal(work.status,'pending')
})

test('CRM-PROD context fusion requires evidence and produces activity plus link',()=>{
  const fused=fuseRelationshipContext({
    entityId:'org:1',
    kind:'document',
    contextRef:'doc:1',
    relation:'evidence_for',
    activityType:'document.linked',
    summary:'Capability statement linked.',
    occurredAt:NOW,
    evidenceRefs:['artifact:1'],
  })
  assert.equal(fused.link.contextKind,'document')
  assert.equal(fused.activity.metadata.authority,'CONTEXT_ONLY')
  assert.throws(()=>fuseRelationshipContext({
    entityId:'org:1',
    kind:'message',
    contextRef:'message:1',
    relation:'sent_to',
    activityType:'message.sent',
    summary:'Message',
    occurredAt:NOW,
    evidenceRefs:[],
  }),/RELATIONSHIP_CONTEXT_EVIDENCE_REQUIRED/)
})

test('CRM-PROD relationship intelligence stays analysis-only and recommends research',()=>{
  const signals=deriveRelationshipIntelligence({
    entityId:'org:1',
    now:NOW,
    activities:[{
      id:'a1',
      entityId:'org:1',
      type:'sam.provider.quote_received',
      occurredAt:'2026-09-01T00:00:00.000Z',
      contextRef:'opp:1',
      summary:'Quote received.',
      evidenceRefs:['quote:1'],
      metadata:{},
    },{
      id:'a2',
      entityId:'org:1',
      type:'commercial.outreach_sent',
      occurredAt:'2026-09-25T00:00:00.000Z',
      summary:'Approved outreach sent.',
      evidenceRefs:['message:1'],
      metadata:{},
    }],
    links:[{
      id:'l1',
      entityId:'org:1',
      contextKind:'opportunity',
      contextRef:'opp:1',
      relation:'sam:provider',
      occurredAt:'2026-09-01T00:00:00.000Z',
      evidenceRefs:['quote:1'],
    }],
    suggestions:[],
    identities:[{
      id:'i1',
      entityId:'org:1',
      scheme:'uei',
      value:'ABC',
      normalizedValue:'ABC',
      evidenceRefs:['sam:1'],
    }],
    roles:[{
      id:'r1',
      entityId:'org:1',
      role:'provider',
      domain:'sam',
      validFrom:'2026-09-01T00:00:00.000Z',
      evidenceRefs:['sam:1'],
    }],
    decisionMakerCount:0,
  })
  assert.equal(signals.every(row=>row.authority==='ANALYSIS_ONLY'),true)
  assert.equal(signals.find(row=>row.kind==='unanswered_thread')?.value,true)
  assert.match(String(signals.find(row=>row.kind==='next_research')?.value),/decision maker|response|quote/i)
})
