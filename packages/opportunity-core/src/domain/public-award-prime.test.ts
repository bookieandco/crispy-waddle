import assert from 'node:assert/strict'
import { buildAwardNeighborProfile } from './award-neighbor-discovery.js'
import {
  assessPublicPrimePackages,
  buildPublicAwardPrimeFingerprints,
  compilePublicSubcontractWorkPackages,
  publicAwardToProviderCandidate,
  type PublicAwardRecord,
} from './public-award-prime.js'

const award:PublicAwardRecord={
  id:'award:la:1',
  opportunityId:'local:ca:la:roof',
  title:'Civic Center Roof Replacement',
  buyer:'Los Angeles County',
  state:'CA',
  county:'Los Angeles',
  awardedPrimeName:'Acme Roofing LLC',
  awardedPrimeRef:'prime:acme-roofing',
  awardAmount:1_000_000,
  currency:'USD',
  naicsCode:'238160',
  pscCode:'Z1AA',
  scopeText:'Remove existing roofing membrane, insulation, flashing and install new roof system.',
  awardDate:'2026-09-15',
  sourceUrl:'https://example.gov/awards/1',
  capturedAt:'2026-10-01T00:00:00Z',
  evidenceRefs:['official-award:1'],
}

const candidate=publicAwardToProviderCandidate(award)
assert.equal(candidate.evidence[0]?.source,'local_public_award')
assert.equal(candidate.awardCount,1)
assert.deepEqual(candidate.naicsCodes,['238160'])

const profile=buildAwardNeighborProfile([candidate])
assert.deepEqual(profile.seedProviderIds,['prime:acme-roofing'])
assert.deepEqual(profile.naicsCodes,['238160'])
assert.deepEqual(profile.pscCodes,['Z1AA'])
assert.ok(profile.evidenceRefs.includes('official-award:1'))

const fingerprints=buildPublicAwardPrimeFingerprints([
  award,
  {...award,id:'award:la:2',awardAmount:500_000,evidenceRefs:['official-award:2']},
])
assert.equal(fingerprints.length,1)
assert.equal(fingerprints[0]?.awardCount,2)
assert.equal(fingerprints[0]?.totalObservedAwardValue,1_500_000)


const normalizedLegalNameFingerprints=buildPublicAwardPrimeFingerprints([
  {
    ...award,
    id:'award:name:1',
    awardedPrimeName:'Acme Roofing, Inc.',
    awardedPrimeRef:undefined,
    evidenceRefs:['official-award:name:1'],
  },
  {
    ...award,
    id:'award:name:2',
    awardedPrimeName:'ACME   ROOFING LLC',
    awardedPrimeRef:undefined,
    evidenceRefs:['official-award:name:2'],
  },
])
assert.equal(normalizedLegalNameFingerprints.length,1)
assert.equal(normalizedLegalNameFingerprints[0]?.awardCount,2)
assert.ok(normalizedLegalNameFingerprints[0]?.providerId.startsWith('local-prime:acme-roofing'))

const packages=compilePublicSubcontractWorkPackages({
  opportunityId:award.opportunityId!,
  opportunityTitle:award.title,
  state:'CA',
  county:'Los Angeles',
  awardedPrimeName:award.awardedPrimeName,
  awardedPrimeRef:award.awardedPrimeRef,
  opportunityAmount:{max:1_000_000,currency:'USD'},
  sourceEvidenceRefs:['official-scope:1'],
  scopeRequirements:[
    {
      id:'roof-demo',
      label:'Roof demolition and disposal',
      description:'Remove existing membrane and insulation and dispose of debris.',
      category:'roofing',
      naicsCodes:['238160'],
      keywords:['roof demolition','membrane removal'],
      estimatedSharePct:20,
      requiredLicenses:['California C-39'],
      evidenceRefs:['scope-line:demo'],
    },
    {
      id:'new-roof',
      label:'New roofing system',
      description:'Install new roofing membrane, flashing and insulation.',
      category:'roofing',
      naicsCodes:['238160'],
      keywords:['roof installation','flashing','insulation'],
      estimatedSharePct:55,
      requiredLicenses:['California C-39'],
      evidenceRefs:['scope-line:install'],
    },
  ],
})
assert.equal(packages.length,2)
assert.equal(packages[0]?.status,'candidate')
assert.equal(packages[0]?.estimatedValue?.max,200_000)
assert.equal(packages[1]?.requirement.geography,'Los Angeles County, CA')
assert.equal(packages[0]?.automaticPrimeContactAuthorized,false)

const assessment=assessPublicPrimePackages({
  opportunityId:award.opportunityId!,
  awardedPrimeName:award.awardedPrimeName,
  packages,
})
assert.equal(assessment.route,'SUB_READY_FOR_REVIEW')
assert.equal(assessment.candidatePackageCount,2)
assert.equal(assessment.externalContactAuthorized,false)

const blocked=compilePublicSubcontractWorkPackages({
  opportunityId:'op:bad',
  opportunityTitle:'Unknown scope',
  state:'CA',
  awardedPrimeName:'Prime',
  sourceEvidenceRefs:[],
  scopeRequirements:[{id:'bad',label:'',estimatedSharePct:120,evidenceRefs:[]}],
})
assert.equal(blocked[0]?.status,'blocked')
assert.ok(blocked[0]?.blockers.some(x=>/source evidence/i.test(x)))
assert.ok(blocked[0]?.blockers.some(x=>/share/i.test(x)))
assert.ok(blocked[0]?.blockers.some(x=>/classification/i.test(x)))

console.log('public award prime/work-package tests passed')
