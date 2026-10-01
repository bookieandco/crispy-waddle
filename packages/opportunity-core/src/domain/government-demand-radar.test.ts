import assert from 'node:assert/strict'
import {
  analyzeSolicitationQa,
  assessFulfillmentPattern,
  buildGovernmentDemandProfiles,
  buildRecompeteWatches,
  type GovernmentDemandObservation,
} from './government-demand-radar.js'

const observations:GovernmentDemandObservation[]=[
  {
    id:'obs:1',buyer:'Fort Example',title:'Military working dog food',stage:'award',
    naicsCodes:['311111'],pscCodes:[],keywords:['dog food','military working dog'],
    awardeeName:'Example Pet Supply',awardAmount:120000,performanceEndDate:'2028-06-30',
    sourceRefs:['award:1'],
  },
  {
    id:'obs:2',buyer:'Fort Example',title:'Kenneling services',stage:'solicitation',
    naicsCodes:['812910'],pscCodes:[],keywords:['kennel','animal care'],
    sourceRefs:['notice:2'],
  },
]
const profiles=buildGovernmentDemandProfiles(observations)
assert.equal(profiles.length,1)
assert.equal(profiles[0]?.observationCount,2)
assert.ok(profiles[0]?.incumbentNames.includes('Example Pet Supply'))

const watches=buildRecompeteWatches({observations,now:'2027-04-01',leadDays:365})
assert.equal(watches.length,1)
assert.equal(watches[0]?.watchStartDate,'2027-07-01')
assert.equal(watches[0]?.status,'watch_later')

const qa=analyzeSolicitationQa([
  {id:'q1',question:'What is the period of performance?',answer:'12 months.',sourceRef:'qa:1'},
  {id:'q2',question:'How many awards do you plan to make?',answer:'Multiple awards may be made.',sourceRef:'qa:1'},
  {id:'q3',question:'Is a background check required for site access?',sourceRef:'qa:2'},
])
assert.equal(qa.questionCount,3)
assert.equal(qa.answeredCount,2)
assert.ok(qa.topics.includes('multiple_awards'))
assert.ok(qa.unresolvedTopics.includes('site_access'))
assert.equal(qa.competitionInferenceAuthorized,false)

const conditional=assessFulfillmentPattern({
  opportunityId:'opp:1',
  deliverableType:'service',
  backgroundCheckRequired:true,
  providerBenchCount:2,
  pricingEvidenceCount:1,
  evidenceRefs:['solicitation:1'],
})
assert.equal(conditional.status,'conditional')

const blocked=assessFulfillmentPattern({
  opportunityId:'opp:2',
  deliverableType:'lease',
  primeMustOwnAsset:true,
  evidenceRefs:['solicitation:2'],
})
assert.equal(blocked.status,'blocked')
assert.ok(blocked.blockers.some(x=>/ownership/i.test(x)))

console.log('government demand radar tests passed')
