import assert from 'node:assert/strict'
import { evaluateMemeProfitFinalEvidence,type MemeProfitFinalEvidence } from './meme-profit-final.js'
import { beginPaperExitCase,advancePaperExitCase } from './meme-paper-exit.js'
import { evaluateMemeStorageReadiness } from './meme-storage-readiness.js'
import type { MemeResearchComparison, MemeResearchScorecard } from './meme-paper-learning.js'
let exit=beginPaperExitCase('study-100','owner-100')
exit=advancePaperExitCase(exit,{action:'PAUSE',at:'2026-10-01T12:00:00Z',note:'Pause paper trading',evidenceRefs:['r:1']})
exit=advancePaperExitCase(exit,{action:'OWNER_REVIEW',at:'2026-10-02T12:00:00Z',note:'Owner paper check',evidenceRefs:['r:2'],ownerConfirmed:true})
exit=advancePaperExitCase(exit,{action:'RECORD_NOTICE',at:'2026-10-03T12:00:00Z',note:'Proposed notice, unverified',evidenceRefs:['r:3'],noticeUrl:'https://example.invalid/notice',termsReference:'terms'})
exit=advancePaperExitCase(exit,{action:'CLOSE_PAPER',at:'2026-10-04T12:00:00Z',note:'Close only synthetic study',evidenceRefs:['r:4']})
const storage=evaluateMemeStorageReadiness({
 deployedProjectId:'vercel:jhadina',configuredSupabaseProjectRef:null,
 accessibleSupabaseProjectRefs:['pupson','swlc'],confirmedJhadinaProjectRef:null,
 canonicalTables:[],migrationApplied:false,serviceProxyVerified:false,
 authenticatedOwnerCrudVerified:false,crossOwnerRejectionVerified:false,
 staleRevisionRejectionVerified:false,adoptionBoundaryVerified:false,
 observedAt:'2026-10-15T21:00:00Z',
})
const card:MemeResearchScorecard={
 mode:'PAPER_ONLY',sourceClass:'SYNTHETIC_FIXTURE',status:'SYNTHETIC_REPLAY',strategyId:'study',
 scoreAt:'2026-10-08T00:00:00Z',firstDay:'2026-10-01',lastDay:'2026-10-07',
 observations:Array.from({length:7},(_,i)=>({day:'2026-10-0'+(i+1),sourceRef:'fixture',admittedAt:'2026-10-07T12:00:00Z',status:'PAPER_SIMULATED' as const,hypotheticalNetPnlUsd:-1,refusalReasons:[]})),
 admittedCount:7,refusedCount:0,meanHypotheticalPnlUsd:-1,worstHypotheticalPnlUsd:-1,
 maxHypotheticalDrawdownUsd:7,netPositiveObservationCount:0,
 actualTrades:0,actualEarningsUsd:0,ownerApprovalForExecution:false,autopilotAuthorized:false,
}
const comparison:MemeResearchComparison={mode:'PAPER_ONLY',ranking:[],winnerForLiveTrading:null,actualEarningsUsd:0}
const evidence:MemeProfitFinalEvidence={
 exactCommit:'a'.repeat(40),allRequiredCiPassed:true,webBuildPassed:true,
 modelTestsPassed:true,crossOwnerTestsPassed:true,modelScoring:[card],comparison,storage,
 exitDryRun:exit,actualDistinctObservationDates:0,liveMarketDataProvenanceVerified:false,
 ownerApprovedRiskLimits:false,independentLegalReviewCompleted:false,
 independentSecurityReviewCompleted:false,productionAuthenticatedCrudReceipt:false,
}
const result=evaluateMemeProfitFinalEvidence(evidence)
assert.equal(result.paperSoftware,'PASS')
assert.equal(result.realSevenDayResearch,'INCOMPLETE')
assert.equal(result.storageCommissioning,'BLOCKED')
assert.equal(result.commercialAcceptance,'NOT_PROVEN')
assert.equal(result.operationalMoneyAuthority,false)
assert.equal(result.liveTokenOperations,'DISABLED')
assert(result.missingEvidence.some(x=>/Seven distinct/.test(x)))
assert(result.missingEvidence.some(x=>/Supabase/.test(x)))
assert.equal(evaluateMemeProfitFinalEvidence({...evidence,allRequiredCiPassed:false}).paperSoftware,'INCOMPLETE')
assert.equal(evaluateMemeProfitFinalEvidence({...evidence,modelScoring:[{...card,actualTrades:1} as unknown as MemeResearchScorecard]}).paperSoftware,'INCOMPLETE')
assert.equal(evaluateMemeProfitFinalEvidence({...evidence,exitDryRun:{...exit,tokenSaleAuthorized:true} as unknown as typeof exit}).paperSoftware,'INCOMPLETE')
assert.throws(()=>evaluateMemeProfitFinalEvidence({...evidence,exactCommit:'unknown'}),/COMMIT/)
console.log('MEME-PROFIT.15–.18 fail-closed commercial acceptance tests passed')
