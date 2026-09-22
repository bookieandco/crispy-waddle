import {describe,expect,it} from 'vitest'
import {
  reconcileMeteoraDlmmCashFlowProfitability,
  reconcileMeteoraDlmmCashFlowProfitabilityFromState,
} from '../meteora-profitability-evidence'

const valuedFlow=(evidenceId:string,kind:'DEPOSIT'|'WITHDRAWAL'|'FEE',amountMinor:bigint,availableAt='2026-09-01T00:00:01Z')=>({
  evidenceId,transactionId:'tx:'+evidenceId,position:'position-1',kind,amountMinor,currency:'USDC',
  amountSemantics:'VERIFIED_VALUATION' as const,valuationEvidenceIds:['price:'+evidenceId],
  observedAt:'2026-09-01T00:00:00Z',availableAt,
})
const nativeFlow=(evidenceId:string,kind:'DEPOSIT'|'WITHDRAWAL'|'FEE',amountMinor:bigint)=>({
  evidenceId,transactionId:'tx:'+evidenceId,position:'position-1',kind,amountMinor,currency:'USDC',
  amountSemantics:'NATIVE_TRANSFER' as const,valuationEvidenceIds:[],
  observedAt:'2026-09-01T00:00:00Z',availableAt:'2026-09-01T00:00:01Z',
})
const state=(overrides:any={})=>({
  stateId:'state-1',position:'position-1',currency:'USDC',positionClosed:true,transactionHistoryComplete:true,
  observedAt:'2026-09-01T00:00:02Z',availableAt:'2026-09-01T00:00:03Z',evidenceIds:['state:e1'],...overrides,
})

describe('Meteora DLMM profitability evidence',()=>{
 it('only promotes cash-flow PnL to realized when closed, complete, and valuation-proven',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitabilityFromState({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',state:state(),
   flows:[valuedFlow('deposit','DEPOSIT',100000n),valuedFlow('withdraw','WITHDRAWAL',108000n),valuedFlow('fee','FEE',4000n)],
  })
  expect(r.netCashFlowMinor).toBe(12000n)
  expect(r.realizedPnlMinor).toBe(12000n)
  expect(r.realizationStatus).toBe('CLOSED_COMPLETE')
  expect(r.valuationStatus).toBe('VERIFIED')
  expect(r.evidenceIds).toEqual(expect.arrayContaining(['state:e1','price:deposit','price:withdraw','price:fee']))
  expect(r.authority).toBe('RESEARCH_ONLY')
 })

 it('does not call deployed/open capital a realized loss',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:false,transactionHistoryComplete:true,
   flows:[valuedFlow('deposit','DEPOSIT',100000n),valuedFlow('fee','FEE',1000n)],
  })
  expect(r.netCashFlowMinor).toBe(-99000n)
  expect(r.realizedPnlMinor).toBeNull()
  expect(r.realizationStatus).toBe('PROVISIONAL_OPEN')
 })

 it('requires valuation provenance before reporting realized PnL',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:true,transactionHistoryComplete:true,
   flows:[nativeFlow('deposit','DEPOSIT',100000n),nativeFlow('withdraw','WITHDRAWAL',110000n)],
  })
  expect(r.netCashFlowMinor).toBe(10000n)
  expect(r.realizedPnlMinor).toBeNull()
  expect(r.valuationStatus).toBe('VALUATION_REQUIRED')
 })

 it('uses one verified representation of a native root flow and refuses competing valuations',()=>{
  const native={...nativeFlow('native-deposit','DEPOSIT',100000n),rootFlowId:'root-deposit'}
  const valued={...valuedFlow('valued-deposit','DEPOSIT',100000n),rootFlowId:'root-deposit'}
  const withdrawal={...valuedFlow('withdraw','WITHDRAWAL',110000n),rootFlowId:'root-withdraw'}
  const r=reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:true,transactionHistoryComplete:true,
   flows:[native,valued,withdrawal],
  })
  expect(r.realizedPnlMinor).toBe(10000n)
  expect(()=>reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:true,transactionHistoryComplete:true,
   flows:[valued,{...valued,evidenceId:'valued-deposit-2',amountMinor:99000n},withdrawal],
  })).toThrow('competing_flow_representations')
 })

 it('refuses to manufacture impermanent loss without a HODL benchmark',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',positionClosed:true,transactionHistoryComplete:true,
   flows:[valuedFlow('deposit','DEPOSIT',100000n),valuedFlow('withdraw','WITHDRAWAL',90000n),valuedFlow('fee','FEE',5000n)],
  })
  expect(r.impermanentLossMinor).toBeNull()
  expect(r.impermanentLossStatus).toBe('BENCHMARK_REQUIRED')
 })

 it('excludes future evidence without letting future knowledge change PIT realization status',()=>{
  const r=reconcileMeteoraDlmmCashFlowProfitabilityFromState({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',state:state(),
   flows:[valuedFlow('deposit','DEPOSIT',100000n),valuedFlow('withdraw','WITHDRAWAL',110000n),valuedFlow('future-fee','FEE',2000n,'2026-09-02T00:00:00Z')],
  })
  expect(r.realizedPnlMinor).toBe(10000n)
  expect(r.realizationStatus).toBe('CLOSED_COMPLETE')
  expect(r.excludedFutureEvidenceIds).toEqual(['future-fee'])
 })

 it('fails closed on future position state, duplicate evidence, and missing valuation lineage',()=>{
  expect(()=>reconcileMeteoraDlmmCashFlowProfitabilityFromState({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-01T01:00:00Z',
   state:state({availableAt:'2026-09-02T00:00:00Z'}),
   flows:[valuedFlow('deposit','DEPOSIT',1n)],
  })).toThrow('state_after_cutoff')

  const d=valuedFlow('dup','DEPOSIT',1n)
  expect(()=>reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-02T00:00:00Z',positionClosed:true,transactionHistoryComplete:true,flows:[d,d]
  })).toThrow('duplicate_evidence')

  expect(()=>reconcileMeteoraDlmmCashFlowProfitability({
   position:'position-1',currency:'USDC',informationCutoff:'2026-09-02T00:00:00Z',positionClosed:true,transactionHistoryComplete:true,
   flows:[{...d,evidenceId:'missing-price',valuationEvidenceIds:[]}]
  })).toThrow('valuation_evidence_required')
 })
})
