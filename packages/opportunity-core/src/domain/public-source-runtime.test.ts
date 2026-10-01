import assert from 'node:assert/strict'
import { runPublicSourceScan, type PublicSourceAdapter, type PublicSourceHealth } from './public-source-runtime.js'
import type { PublicProcurementSource } from './public-opportunity-grid.js'

const source:PublicProcurementSource={
  id:'ca.los-angeles-county.test',
  name:'LA County test source',
  jurisdictionLevel:'county',
  state:'CA',
  county:'Los Angeles',
  officialUrl:'https://example.gov/opportunities',
  sourceKinds:['solicitation'],
  adapterKind:'html',
  refreshPolicy:'every_4_hours',
  status:'active',
  authority:'official',
  evidenceRefs:['source:evidence'],
}

const adapter:PublicSourceAdapter={
  sourceId:source.id,
  async fetch({now}){
    return {
      sourceId:source.id,
      signals:[{
        id:'local:test:1',
        sourceId:source.id,
        sourceUrl:source.officialUrl!,
        sourceName:source.name,
        title:'Example opportunity',
        stage:'open_solicitation',
        state:'CA',
        county:'Los Angeles',
        externalId:'TEST-1',
        capturedAt:now,
        evidenceRef:'evidence:test:1',
      }],
      checkpoint:{sourceId:source.id,lastExternalId:'TEST-1',lastObservedAt:now},
      fetchedAt:now,
      evidenceRefs:['evidence:test:1'],
    }
  },
}

const pass=await runPublicSourceScan({source,adapter,now:'2026-09-30T20:00:00Z'})
assert.equal(pass.health.status,'healthy')
assert.equal(pass.signals.length,1)
assert.equal(pass.externalContactAuthorized,false)
assert.equal(pass.bidSubmissionAuthorized,false)

let previous:PublicSourceHealth|undefined
for(let attempt=0;attempt<3;attempt+=1){
  const broken:PublicSourceAdapter={sourceId:source.id,async fetch(){throw new Error('parser_contract_changed')}}
  const failed=await runPublicSourceScan({
    source,
    adapter:broken,
    previousHealth:previous,
    now:`2026-09-30T20:0${attempt}:00Z`,
  })
  previous=failed.health
}
assert.equal(previous?.status,'failed')
assert.equal(previous?.consecutiveFailures,3)
assert.equal(previous?.errorCode,'parser_contract_changed')

const mismatch:PublicSourceAdapter={sourceId:'wrong',async fetch(){throw new Error('unused')}}
await assert.rejects(()=>runPublicSourceScan({source,adapter:mismatch}),/mismatch/i)

console.log('public source runtime tests passed')
