import assert from 'node:assert/strict'
import { evaluateSamLiveCertification } from './sam-live-certification.js'
{
 const report=evaluateSamLiveCertification([{checkedAt:'2026-09-20T00:00:00Z',configured:true,requestSucceeded:true,resultCount:2,canonicalizedCount:2,uniqueOpportunityIds:2,duplicateCount:0,malformedCount:0,paginationObserved:true}])
 assert.equal(report.status,'pass');assert.equal(report.bidSubmissionAuthorized,false);assert.equal(report.outreachAuthorized,false)
}
{
 const report=evaluateSamLiveCertification([{checkedAt:'2026-09-20T00:00:00Z',configured:false,requestSucceeded:false,resultCount:0,canonicalizedCount:0,uniqueOpportunityIds:0,duplicateCount:0,malformedCount:0,paginationObserved:false}])
 assert.equal(report.status,'environment_blocked')
}
