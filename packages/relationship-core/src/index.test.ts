import {strict as assert} from 'node:assert'
import test from 'node:test'
import {
  EvidenceLedger,InMemoryRelationshipStore,InMemoryRelationshipWorkQueue,RelationshipMetadataRegistry,
  buildRelationshipRecordWorkspace,certifyCrmSpine,projectDomainRelationship,projectSamProviderEvent
} from './index.js'

const NOW='2026-09-29T15:00:00.000Z'
const USER='00000000-0000-0000-0000-000000000001'

function organization(id='org:acme'){
  return {id,ownerUserId:USER,kind:'organization' as const,displayName:'ACME Construction',aliases:[] as const,status:'active' as const,evidenceRefs:['obs:domain'] as const,createdAt:NOW,updatedAt:NOW,authority:'RELATIONSHIP_INTELLIGENCE_ONLY' as const}
}

test('CRM-SPINE.1 canonical entity rejects identity collisions',()=>{
  const store=new InMemoryRelationshipStore()
  store.upsertEntity(organization('org:a'));store.upsertEntity(organization('org:b'))
  store.addIdentity({id:'id:a',entityId:'org:a',scheme:'domain',value:'acme.example',normalizedValue:'acme.example',evidenceRefs:['obs:a']})
  assert.throws(()=>store.addIdentity({id:'id:b',entityId:'org:b',scheme:'domain',value:'ACME.EXAMPLE',normalizedValue:'acme.example',evidenceRefs:['obs:b']}),/RELATIONSHIP_IDENTITY_COLLISION/)
})

test('CRM-SPINE.2 evidence admits strong facts and queues weak evidence',()=>{
  const ledger=new EvidenceLedger()
  ledger.appendObservation({id:'obs:strong',entityId:'org:acme',sourceRef:'signature:1',sourceKind:'signature_block',field:'email',observedValue:'a@acme.example',observedAt:NOW,strength:'strong',payload:{method:'observed'}})
  assert.equal(ledger.evaluate({id:'fact:email',entityId:'org:acme',field:'email',value:'a@acme.example',evidenceRefs:['obs:strong'],proposedAt:NOW}).decision,'verify')
  ledger.appendObservation({id:'obs:weak',entityId:'org:acme',sourceRef:'snippet:1',sourceKind:'search',field:'employeeCount',observedValue:50,observedAt:NOW,strength:'weak',payload:{method:'search'}})
  assert.equal(ledger.evaluate({id:'fact:employees',entityId:'org:acme',field:'employeeCount',value:50,evidenceRefs:['obs:weak'],proposedAt:NOW}).decision,'review')
  assert.throws(()=>ledger.appendObservation({id:'bad',entityId:'org:acme',sourceRef:'model',sourceKind:'model',observedAt:NOW,strength:'weak',payload:{confidence:0.99}}),/RELATIONSHIP_MODEL_SELF_CONFIDENCE_FORBIDDEN/)
})

test('CRM-SPINE.3 and .8 unify cross-domain context',()=>{
  const store=new InMemoryRelationshipStore();store.upsertEntity(organization())
  const projections=[
    projectDomainRelationship({organizationId:'org:acme',ownerUserId:USER,displayName:'ACME Construction',domain:'sam',role:'provider',contextRef:'sam:opp:1',occurredAt:NOW,evidenceRefs:['sam:1'],activityType:'sam.provider.discovered',activitySummary:'Provider discovered.'}),
    projectDomainRelationship({organizationId:'org:acme',ownerUserId:USER,displayName:'ACME Construction',domain:'commerce',role:'customer',contextRef:'order:1',occurredAt:NOW,evidenceRefs:['receipt:1'],activityType:'commerce.order.completed',activitySummary:'Order completed.'})
  ]
  for(const row of projections){store.addRole(row.role);store.addActivity(row.activity);store.addContextLink(row.contextLink)}
  assert.deepEqual(new Set(store.listRoles('org:acme').map(row=>row.role)),new Set(['provider','customer']))
  assert.equal(store.listActivities('org:acme').length,2);assert.equal(store.listLinks('org:acme').length,2)
})

test('CRM-SPINE.4 leases due work and reclaims expired leases',()=>{
  const queue=new InMemoryRelationshipWorkQueue()
  queue.enqueue({id:'work:1',ownerUserId:USER,capability:'relationship.research',entityRef:'org:acme',reason:'Recheck.',dueAt:NOW,priority:10,status:'pending',attemptCount:0,correlationId:'corr:1',evidenceRefs:['sam:1'],executionAuthorized:false})
  assert.equal(queue.claimDue(NOW,'worker:a',1000,1).length,1)
  assert.equal(queue.claimDue(NOW,'worker:b',1000,1).length,0)
  const reclaimed=queue.claimDue('2026-09-29T15:00:02.000Z','worker:b',1000,1)
  assert.equal(reclaimed[0]?.leaseOwner,'worker:b');assert.equal(reclaimed[0]?.attemptCount,2)
  assert.equal(queue.complete('work:1','worker:b').status,'completed')
})

test('CRM-SPINE.5 metadata objects validate pipeline state',()=>{
  const registry=new RelationshipMetadataRegistry()
  registry.registerObject({id:'deal',labelSingular:'Deal',labelPlural:'Deals',fields:[{key:'amount',label:'Amount',type:'currency',required:true},{key:'source',label:'Source',type:'enum',options:['sam','referral']}]})
  registry.registerPipeline({id:'pipe',label:'Deal Pipeline',objectDefinitionId:'deal',stages:[{id:'new',label:'New',order:1},{id:'qualified',label:'Qualified',order:2}]})
  const record=registry.createRecord({id:'rec:1',entityId:'org:acme',pipelineId:'pipe',stageId:'new',values:{amount:25000,source:'sam'},updatedAt:NOW})
  assert.equal(registry.moveRecord(record,'qualified',NOW).stageId,'qualified')
  assert.throws(()=>registry.createRecord({...record,values:{amount:25000,source:'invalid'}}),/RELATIONSHIP_FIELD_OPTION/)
})

test('CRM-SPINE.6 record workspace surfaces Agent work',()=>{
  const store=new InMemoryRelationshipStore();store.upsertEntity(organization())
  store.addRole({id:'role:1',entityId:'org:acme',role:'provider',domain:'sam',contextRef:'sam:opp:1',validFrom:NOW,evidenceRefs:['sam:1']})
  store.addContextLink({id:'link:1',entityId:'org:acme',contextKind:'opportunity',contextRef:'sam:opp:1',relation:'sam:provider',occurredAt:NOW,evidenceRefs:['sam:1']})
  const workspace=buildRelationshipRecordWorkspace(store,'org:acme',[{id:'work:1',ownerUserId:USER,capability:'relationship.research',entityRef:'org:acme',reason:'Recheck.',dueAt:NOW,priority:1,status:'pending',attemptCount:0,correlationId:'corr:1',evidenceRefs:['sam:1'],executionAuthorized:false}])
  assert.equal(workspace.tabs.includes('Agent'),true);assert.equal(workspace.agent.queued.length,1);assert.equal(workspace.linkedContexts[0]?.ref,'sam:opp:1')
})

test('CRM-SPINE.7 preserves SAM authority while projecting shared relationship state',()=>{
  const row=projectSamProviderEvent({ownerUserId:USER,organizationId:'provider:1',displayName:'Provider One',event:{providerId:'provider:1',opportunityId:'sam:99',kind:'quote_received',occurredAt:NOW,evidenceRefs:['quote:99']}})
  assert.equal(row.role.role,'provider');assert.equal(row.activity.type,'sam.provider.quote_received');assert.equal(row.entity.authority,'RELATIONSHIP_INTELLIGENCE_ONLY')
})

test('CRM-SPINE.FINAL passes all ten gates',()=>{
  const result=certifyCrmSpine()
  assert.equal(result.passed,true);assert.equal(result.stages.length,10);assert.equal(result.stages.every(stage=>stage.passed),true);assert.equal(result.stages.at(-1)?.id,'CRM-SPINE.FINAL')
})
