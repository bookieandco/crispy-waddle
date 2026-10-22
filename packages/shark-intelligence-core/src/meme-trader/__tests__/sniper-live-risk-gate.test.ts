import {describe,expect,it} from 'vitest'
import {assessSniperLiveRisk,type SniperVerifiedEvidence} from '../sniper-live-risk-gate'
const now='2026-10-21T20:00:00.500Z'
const e:SniperVerifiedEvidence={
 chainId:'solana-mainnet',tokenAddress:'MINT',observedAt:'2026-10-21T20:00:00Z',
 availableAt:'2026-10-21T20:00:00.100Z',evidenceIds:['rpc:slot:1'],
 proof:'CHAIN_ATTESTED',confirmedSellRoute:true,exitLiquidityLamports:10000000n,
 creatorClusterChecked:true,independentHolderCoverage:true,lpControlChecked:true,tokenAuthorityChecked:true,
}
const check=(evidence:SniperVerifiedEvidence=e,rug:any={evidence:[{source:'chain',observedAt:now,label:'slot:1'}]},creatorBadLaunchRate?:number)=>assessSniperLiveRisk({
 evidence,rug,now,maxEvidenceAgeMs:1000,creatorBadLaunchRate,
})
describe('SHARK live-wiring risk',()=>{
 it('allows research paper candidate only with all independently checked risk families',()=>{
  expect(check().disposition).toBe('PAPER_CANDIDATE')
  expect(check().canExecute).toBe(false)
 })
 it('identifies the mechanism but blocks confirmed sell restrictions',()=>{
  const result=check(e,{nonTransferable:true,evidence:[{source:'chain',observedAt:now,label:'slot:1'}]})
  expect(result.disposition).toBe('BLOCK')
  expect(result.mechanisms.map(x=>x.mechanism)).toContain('SELL_RESTRICTION')
 })
 it('refuses unverifiable reverse path, source proof, actor coverage and stale signals',()=>{
  expect(check({...e,confirmedSellRoute:false}).reasonCodes).toContain('SELL_ROUTE_NOT_PROVEN')
  expect(check({...e,proof:'UNVERIFIED'}).reasonCodes).toContain('ONCHAIN_ATTESTATION_REQUIRED')
  expect(check({...e,creatorClusterChecked:false}).disposition).toBe('BLOCK')
  expect(check({...e,availableAt:'2026-10-21T19:00:00Z'}).disposition).toBe('BLOCK')
 })
 it('blocks repeat bad deployers before they reach the paper executor',()=>{
  expect(check(e,undefined,.8).reasonCodes).toContain('CREATOR_REPEATED_BAD_LAUNCHES')
 })
})
