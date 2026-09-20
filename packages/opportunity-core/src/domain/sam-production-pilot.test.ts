import assert from 'node:assert/strict'
import { evaluateSamProductionPilot } from './sam-production-pilot.js'
const cases=['a','b','c'].map(id=>({id,opportunityId:'o:'+id,liveCertification:'pass' as const,researchStatus:'needs_evidence' as const,candidateCount:2,identityBlockedCount:1,freshnessBlockedCount:0,falsePositiveCount:0,humanOverrideCount:0,unauthorizedActionCount:0,persistenceRecovered:true}))
const report=evaluateSamProductionPilot(cases)
assert.equal(report.status,'pass');assert.equal(report.caseCount,3);assert.equal(report.bidSubmissionAuthorized,false);assert.equal(report.automaticOutreachAuthorized,false)
const failed=evaluateSamProductionPilot([{...cases[0],unauthorizedActionCount:1},cases[1],cases[2]])
assert.equal(failed.status,'fail')
