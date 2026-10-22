import assert from 'node:assert/strict'
import { normalizeSuperteamAgentListings } from './zero-rig-superteam.js'
import { createRevenueSuperteamDetailReader, reviewRevenueSuperteamDetail, superteamDetailUrl } from './revenue-superteam-details.js'
import { normalizeMarketplaceBounties } from './revenue-marketplaces.js'
import { scoreEarnedRevenueOpportunity } from './revenue-economics.js'

const now='2026-10-22T18:00:00.000Z'
const future='2026-11-22T18:00:00.000Z'
const item={id:'s1',slug:'build-agent-api',title:'Build agent API',status:'OPEN',
  agentAccess:'AGENT_ONLY',type:'bounty',deadline:future,
  skills:['typescript'],rewardAmount:1000,token:'USDC'}
const summary=normalizeSuperteamAgentListings({result:[item]},now).listings[0]!
assert.ok(summary)
const seen:string[]=[]
const key='sk_testOnly123456789'
const reader=createRevenueSuperteamDetailReader({apiKey:key,fetchImpl:async(url,init)=>{
  seen.push(String(url))
  assert.equal(init?.method,'GET')
  assert.equal(init?.redirect,'error')
  assert.equal(new Headers(init?.headers).get('authorization'),'Bearer '+key)
  return new Response(JSON.stringify({result:item}),{headers:{'content-type':'application/json'}})
}})
const body=await reader.readDetail('build-agent-api')
assert.equal(seen.length,1)
assert.equal(seen[0],superteamDetailUrl('build-agent-api'))
const detail=reviewRevenueSuperteamDetail(body,summary,now)
assert.equal(detail.state,'source_consistent')
assert.match(detail.sourceHash!,/^[a-f0-9]{64}$/)
assert.equal(detail.individualRewardUsd,null)
assert.equal(detail.payoutVerified,false)
assert.equal(detail.submissionAuthorized,false)
for(const slug of ['../secret','https://evil.test','foo?bar','UPPERCASE']) {
  assert.throws(()=>superteamDetailUrl(slug),/SLUG_INVALID/)
}
assert.throws(()=>createRevenueSuperteamDetailReader({apiKey:'bad'}),/KEY_MISSING/)
assert.equal(reviewRevenueSuperteamDetail({result:{...item,status:'CLOSED'}},summary,now).state,'blocked')
assert.equal(reviewRevenueSuperteamDetail({result:{...item,agentAccess:'HUMAN_ONLY'}},summary,now).state,'blocked')
assert.equal(reviewRevenueSuperteamDetail({result:{...item,id:'other'}},summary,now).state,'blocked')
assert.equal(reviewRevenueSuperteamDetail({result:{...item,deadline:now}},summary,now).state,'blocked')
await assert.rejects(()=>createRevenueSuperteamDetailReader({
 apiKey:key,fetchImpl:async()=>new Response('secret',{status:401}),
}).readDetail(summary.slug),/AUTH_BLOCKED/)
await assert.rejects(()=>createRevenueSuperteamDetailReader({
 apiKey:key,fetchImpl:async()=>new Response('x'.repeat(5000),{headers:{'content-type':'application/json','content-length':'300000'}}),
}).readDetail(summary.slug),/BODY_LIMIT/)
await assert.rejects(()=>createRevenueSuperteamDetailReader({
 apiKey:key,fetchImpl:async()=>new Response('<html>',{headers:{'content-type':'text/html'}}),
}).readDetail(summary.slug),/JSON_REQUIRED/)

const baseMarket={
 platform:'opire' as const,sourceUrl:'https://opire.dev/rewards/123',
 githubIssueUrl:'https://github.com/example/repo/issues/31',title:'Fix public parser',
 status:'OPEN' as const,capturedAt:now,rewardAmount:500,rewardCurrency:'USD',
 payerDisplayName:'Alice',competingClaims:null,
}
const market=normalizeMarketplaceBounties([
 baseMarket,
 {...baseMarket}, // exact issue repeated
 {...baseMarket,platform:'algora',sourceUrl:'https://algora.io/example/bounties',githubIssueUrl:'https://github.com/example/repo/issues/32'},
 {...baseMarket,sourceUrl:'https://opire.dev.evil.test/rewards/123',githubIssueUrl:'https://github.com/example/repo/issues/33'},
 {...baseMarket,sourceUrl:'https://opire.dev/rewards/77',githubIssueUrl:'https://github.com/example/repo/pull/23'},
 {...baseMarket,status:'CLOSED',githubIssueUrl:'https://github.com/example/repo/issues/35'},
],now)
assert.equal(market.opportunities.length,2)
assert.equal(market.duplicateCount,1)
assert.equal(market.rejectedCount,3)
assert.equal(market.executionAuthorized,false)
assert.equal(market.paymentVerified,false)
assert.equal(market.opportunities[0]?.verificationStatus,'unverified')
assert.equal(market.opportunities[0]?.amount?.max,500)
assert.ok(market.opportunities[0]?.riskFlags.includes('direct_payer_no_guaranteed_escrow'))
assert.ok(market.opportunities[1]?.riskFlags.includes('escrow_not_independently_verified'))
const stale=normalizeMarketplaceBounties([{...baseMarket,capturedAt:'2026-10-01T00:00:00.000Z'}],now)
assert.equal(stale.opportunities.length,0)
assert.throws(()=>normalizeMarketplaceBounties(new Array(101).fill(baseMarket),now),/BATCH_LIMIT/)
assert.equal(normalizeMarketplaceBounties([{...baseMarket,rewardAmount:NaN}],now).opportunities[0]?.amount,undefined)

const scoreBase={
 id:'bounty-1',now,sourceObservedAt:now,deadline:future,
 sourceStatus:'OPEN' as const,aiWorkAllowed:true,operatorEligible:true,
 payerEvidenceRefs:['official:payer:1'],termsEvidenceRefs:['official:terms:2'],
 paymentAssurance:'verified_escrow' as const,payoutKind:'individual_cash' as const,
 individualRewardUsd:1000,rewardEvidenceRef:'official:prize:1',
 rewardValuationAt:now,probabilityFinish:0.8,probabilityAcceptedGivenFinished:0.5,
 probabilityPaidGivenAccepted:0.8,estimatedWorkHours:4,reviewHours:1,
 laborOpportunityCostUsdPerHour:20,computeCostUsd:5,platformFeesUsd:10,
 fulfillmentCostUsd:10,reworkReserveUsd:5,maxComputeBudgetUsd:10,
 minimumExpectedNetUsdPerHour:15,activeCompetitors:3,saturationThreshold:20,
}
const score=scoreEarnedRevenueOpportunity(scoreBase)
assert.equal(score.decision,'research_candidate')
assert.equal(score.predictedSuccessProbability,0.32000000000000006)
assert.equal(score.expectedGrossUsd,320.00000000000006)
assert.ok(Math.abs(score.expectedNetUsd!-190)<1e-6)
assert.ok(Math.abs(score.expectedNetUsdPerHour!-38)<1e-6)
assert.equal(score.earningsRecognizedUsd,0)
assert.equal(score.submissionAuthorized,false)
assert.equal(score.spendingAuthorized,false)
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,payoutKind:'prize_pool'}).decision,'blocked')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,payoutKind:'prize_pool'}).expectedGrossUsd,null)
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,payoutKind:'api_credits'}).decision,'blocked')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,aiWorkAllowed:false}).decision,'blocked')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,operatorEligible:false}).decision,'blocked')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,sourceStatus:'CLOSED'}).decision,'blocked')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,deadline:now}).decision,'blocked')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,computeCostUsd:11}).decision,'blocked')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,payerEvidenceRefs:[]}).decision,'insufficient_evidence')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,paymentAssurance:'direct_payer_unverified'}).decision,'insufficient_evidence')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,activeCompetitors:20}).decision,'insufficient_evidence')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,activeCompetitors:null}).decision,'insufficient_evidence')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,probabilityPaidGivenAccepted:null}).decision,'insufficient_evidence')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,individualRewardUsd:null}).decision,'insufficient_evidence')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,sourceObservedAt:'2026-10-01T00:00:00.000Z'}).decision,'insufficient_evidence')
assert.equal(scoreEarnedRevenueOpportunity({...scoreBase,minimumExpectedNetUsdPerHour:50}).decision,'reject_unprofitable')
assert.throws(()=>scoreEarnedRevenueOpportunity({...scoreBase,maxComputeBudgetUsd:-1}),/POLICY_INVALID/)
console.log('JH-REVENUE.01–.04 deterministic source and economic gates passed; no external action')
