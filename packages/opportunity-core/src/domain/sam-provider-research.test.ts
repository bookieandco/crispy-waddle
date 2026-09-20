import assert from 'node:assert/strict'
import { runSamProviderResearch } from './sam-provider-research.js'

{
  const result=await runSamProviderResearch({
    requirements:{opportunityId:'sam:pilot',generatedAt:'2026-09-20T00:00:00Z',unresolved:[],requirements:[
      {id:'r1',opportunityId:'sam:pilot',kind:'naics',summary:'541512',severity:'required',evidenceStatus:'explicit',tokens:['541512'],sourceEvidenceIds:['e:sam']},
      {id:'r2',opportunityId:'sam:pilot',kind:'capability',summary:'cloud migration',severity:'required',evidenceStatus:'explicit',tokens:['cloud','migration'],sourceEvidenceIds:['e:sam']},
    ]},
    adapters:[{id:'directory',source:'entity_directory',async discover(input){
      assert.ok(input.naicsCodes.includes('541512'))
      return [{source:'entity_directory',sourceId:'entity:1',observedAt:'2026-09-20T00:00:00Z',legalName:'Pilot Provider LLC',uei:'UEI-PILOT',evidenceRef:'e:entity',capabilities:[{name:'cloud migration',naicsCodes:['541512']}]}]
    }}],
    knownProviders:[],
    now:'2026-09-20T00:00:00Z',
  })
  assert.equal(result.opportunityId,'sam:pilot')
  assert.equal(result.discovery.providers.length,1)
  assert.equal(result.outreachAuthorized,false)
  assert.equal(result.bidSubmissionAuthorized,false)
  assert.equal(result.researchStatus,'needs_evidence')
  assert.ok(result.blockers.some(x=>x.includes('identity unmatched')))
}
