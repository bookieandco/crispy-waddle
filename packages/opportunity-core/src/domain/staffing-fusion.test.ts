import assert from 'node:assert/strict'
import type { CareerPassportSnapshot } from '@staffing/core/domain'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import { buildWorkforceFulfillmentPlan, matchStaffingSnapshotToRequirements } from './staffing-fusion.js'
const set:OpportunityRequirementSet={opportunityId:'o',generatedAt:'x',unresolved:[],requirements:[{id:'r1',opportunityId:'o',kind:'capability',label:'Cloud security',severity:'required',evidenceStatus:'explicit',sourceClaimIds:[],sourceEvidenceIds:[],naicsCodes:[],pscCodes:[],keywords:['cloud','security'],attributes:{},confidence:1,blockers:[]}]}
const s:CareerPassportSnapshot={workerId:'w1',skills:['cloud security'],verifiedCredentials:[],availability:'October',workHistory:[],consentScopes:['opportunity_fulfillment']}
const m=matchStaffingSnapshotToRequirements(s,set);assert.equal(m.score,100);assert.equal(m.consentEligible,true)
const p=buildWorkforceFulfillmentPlan(set,[m]);assert.deepEqual(p.workerIds,['w1']);assert.equal(p.placementAuthorized,false)
const noConsent=matchStaffingSnapshotToRequirements({...s,workerId:'w2',consentScopes:[]},set);assert.equal(noConsent.consentEligible,false)
console.log('staffing-fusion tests passed')
