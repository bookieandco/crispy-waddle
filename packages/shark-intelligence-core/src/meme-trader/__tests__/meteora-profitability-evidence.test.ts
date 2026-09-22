import {describe,expect,it} from 'vitest'
import {reconcileMeteoraDlmmCashFlowProfitability} from '../meteora-profitability-evidence'

const flow=(evidenceId:string,kind:'DEPOSIT'|'WITHDRAWAL'|'FEE',amountMinor:bigint,availableAt='2026-09-01T00:00:01Z')=>({
 evidenceId,transactionId:'tx:'+evidenceId,position:'position-1',kind,amountMinor,currency:'USDC',
 observedAt:'2026-09-01T00:00:00Z',availableAt,
})

describe('Meteora DLMM profitability evidence',()=>{
 it('only promotes cash-flow PnL to realized when the position is closed and history is complete',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:true,transactionHistoryComplete:true,
   flows:[flow('deposit','DEPOSIT',100000n),flow('withdraw','WITHDRAWAL',108000n),flow('fee','FEE',4000n)],
  })
  expect(r.netCashFlowMinor).toBe(12000n)
  expect(r.realizedPnlMinor).toBe(12000n)
  expect(r.estimatedProfitabilityMinor).toBe(12000n)
  expect(r.estimatedProfitabilityStatus).toBe('CASH_FLOW_ESTIMATE_ONLY')
  expect(r.realizationStatus).toBe('CLOSED_COMPLETE')
  expect(r.authority).toBe('RESEARCH_ONLY')
 })

 it('does not call deployed/open capital a realized loss',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:false,transactionHistoryComplete:true,
   flows:[flow('deposit','DEPOSIT',100000n),flow('fee','FEE',1000n)],
  })
  expect(r.netCashFlowMinor).toBe(-99000n)
  expect(r.realizedPnlMinor).toBeNull()
  expect(r.estimatedProfitabilityMinor).toBe(-99000n)
  expect(r.estimatedProfitabilityStatus).toBe('CASH_FLOW_ESTIMATE_ONLY')
  expect(r.realizationStatus).toBe('PROVISIONAL_OPEN')
 })

 it('refuses to manufacture impermanent loss without a HODL benchmark',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:true,transactionHistoryComplete:true,
   flows:[flow('deposit','DEPOSIT',100000n),flow('withdraw','WITHDRAWAL',90000n),flow('fee','FEE',5000n)],
  })
  expect(r.impermanentLossMinor).toBeNull()
  expect(r.impermanentLossStatus).toBe('BENCHMARK_REQUIRED')
 })

 it('marks PIT-incomplete histories provisional and identifies excluded future evidence',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:true,transactionHistoryComplete:true,
   flows:[flow('deposit','DEPOSIT',100000n),flow('future-withdraw','WITHDRAWAL',110000n,'2026-09-02T00:00:00Z')],
  })
  expect(r.realizedPnlMinor).toBeNull()
  expect(r.realizationStatus).toBe('PROVISIONAL_INCOMPLETE')
  expect(r.excludedFutureEvidenceIds).toEqual(['future-withdraw'])
 })

 it('fails closed on duplicate or mismatched cash-flow evidence',()=>{
  const d=flow('dup','DEPOSIT',1n)
  expect(()=>reconcileMeteoraDlmmCashFlowProfitability({position:'position-1',currency:'USDC',informationCutoff:'2026-09-02T00:00:00Z',positionClosed:true,transactionHistoryComplete:true,flows:[d,d]})).toThrow('duplicate_evidence')
  expect(()=>reconcileMeteoraDlmmCashFlowProfitability({position:'position-1',currency:'USDC',informationCutoff:'2026-09-02T00:00:00Z',positionClosed:true,transactionHistoryComplete:true,flows:[{...d,currency:'SOL'}]})).toThrow('flow_identity_mismatch')
 })
})
