import {describe,expect,it} from 'vitest'
import {evaluateCreatorLaunchTrigger} from '../creator-launch-trigger'

describe('creator launch trigger',()=>{
 const policy={
  policyId:'known-dev',
  creatorWalletIds:['DEV1'],
  exactName:'Meanie',
  exactTicker:'MEAN',
  allowedLaunchpads:['pumpfun'],
  minCreatorBuyQuoteRaw:'100',
  maxCreatorBuyQuoteRaw:'1000',
  maxRecentTokensCreated:3,
 } as const

 it('matches a fully evidenced creator launch without granting trade authority',()=>{
  const result=evaluateCreatorLaunchTrigger(policy,{
   observationId:'launch:1',creatorWalletId:'DEV1',tokenName:'Meanie',tokenTicker:'MEAN',launchpad:'pumpfun',
   creatorBuyQuoteRaw:'500',recentTokensCreated:1,observedAt:'2026-10-03T03:00:00Z',evidenceIds:['chain:create'],
  })
  expect(result.disposition).toBe('MATCH')
  expect(result.canAuthorizeTrade).toBe(false)
  expect(result.authority).toBe('DISCOVERY_ONLY')
 })

 it('rejects oversized creator buys and rapid multi-launch behavior',()=>{
  const result=evaluateCreatorLaunchTrigger(policy,{
   observationId:'launch:2',creatorWalletId:'DEV1',tokenName:'Meanie',tokenTicker:'MEAN',launchpad:'pumpfun',
   creatorBuyQuoteRaw:'5000',recentTokensCreated:8,observedAt:'2026-10-03T03:00:00Z',evidenceIds:['chain:create'],
  })
  expect(result.disposition).toBe('REJECT')
  expect(result.rejected).toContain('creator-buy-above-maximum')
  expect(result.rejected).toContain('creator-recent-token-count-high')
 })

 it('fails to review rather than match when required creator evidence is missing',()=>{
  const result=evaluateCreatorLaunchTrigger(policy,{
   observationId:'launch:3',tokenName:'Meanie',tokenTicker:'MEAN',launchpad:'pumpfun',
   observedAt:'2026-10-03T03:00:00Z',evidenceIds:['chain:create'],
  })
  expect(result.disposition).toBe('REVIEW')
  expect(result.missing).toContain('creator-wallet')
  expect(result.missing).toContain('creator-buy')
 })
})
