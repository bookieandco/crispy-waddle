import {strict as assert} from 'node:assert'
import test from 'node:test'
import type {BrokerProviderCandidate} from './sam-provider-broker.js'
import type {PublicAwardPrimeFingerprint,PublicSubcontractWorkPackage} from './public-award-prime.js'
import {matchPrimeToSubcontractors} from './prime-subcontractor-matching.js'

const prime:PublicAwardPrimeFingerprint={
  providerId:'prime:1',
  providerName:'Prime One',
  awardCount:4,
  states:['CA'],
  buyers:['Los Angeles County'],
  naicsCodes:['541512'],
  pscCodes:['DA01'],
  capabilityKeywords:['systems integration'],
  evidenceRefs:['award:prime:1'],
}

const pkg:PublicSubcontractWorkPackage={
  id:'public-work-package:opp:1:cyber',
  opportunityId:'opp:1',
  awardedPrimeName:'Prime One',
  awardedPrimeRef:'prime:1',
  label:'Cybersecurity support',
  description:'Security engineering and systems integration support.',
  geography:'Los Angeles, CA',
  requiredLicenses:[],
  requiredCertifications:[],
  requirement:{
    id:'req:cyber',
    label:'Cybersecurity support',
    naicsCodes:['541512'],
    pscCodes:['DA01'],
    geography:'Los Angeles, CA',
    keywords:['cybersecurity','systems integration'],
  },
  evidenceRefs:['package:1'],
  status:'candidate',
  blockers:[],
  humanReviewRequired:true,
  automaticPrimeContactAuthorized:false,
  automaticProviderOutreachAuthorized:false,
  bidSubmissionAuthorized:false,
}

const sub:BrokerProviderCandidate={
  id:'sub:1',
  legalName:'Qualified Sub One',
  country:'US',
  naicsCodes:['541512'],
  keywords:['cybersecurity','systems integration','engineering'],
  awardCount:2,
  evidence:[
    {id:'sam:sub:1',source:'sam_entity'},
    {id:'award:sub:1',source:'usaspending'},
  ],
}

test('matches a subcontractor to the prime by opportunity work package',()=>{
  const matrix=matchPrimeToSubcontractors({
    opportunityId:'opp:1',
    prime,
    workPackages:[pkg],
    subcontractors:[{
      provider:sub,
      serviceAreas:['Los Angeles, CA','California'],
      capacity:'available',
      observedAt:'2026-09-29T00:00:00.000Z',
    }],
    now:'2026-10-01T00:00:00.000Z',
  })
  assert.equal(matrix.primeProviderId,'prime:1')
  assert.equal(matrix.candidateCount,1)
  assert.equal(matrix.matches[0]?.subcontractorProviderId,'sub:1')
  assert.equal(matrix.matches[0]?.disposition,'matched_candidate')
  assert.equal(matrix.matches[0]?.externalContactAuthorized,false)
  assert.equal(matrix.matches[0]?.automaticProviderOutreachAuthorized,false)
  assert.equal(matrix.matches[0]?.bidSubmissionAuthorized,false)
  assert.ok((matrix.matches[0]?.evidenceRefs.length??0)>=3)
})

test('blocks a subcontractor with unavailable capacity',()=>{
  const matrix=matchPrimeToSubcontractors({
    opportunityId:'opp:1',
    prime,
    workPackages:[pkg],
    subcontractors:[{
      provider:sub,
      serviceAreas:['Los Angeles, CA'],
      capacity:'unavailable',
      observedAt:'2026-09-29T00:00:00.000Z',
    }],
    now:'2026-10-01T00:00:00.000Z',
  })
  assert.equal(matrix.blockedCount,1)
  assert.equal(matrix.matches[0]?.disposition,'blocked')
  assert.ok(matrix.matches[0]?.blockers.includes('Provider capacity is unavailable.'))
})
