import {describe,expect,it} from 'vitest'
import {applyVerifiedMeteoraCashFlowValuation,deriveMeteoraNativeCashFlowEvidence} from '../meteora-cash-flow-producer'

describe('Meteora cash-flow evidence producer',()=>{
  it('emits one native flow per explicit nonzero transaction asset without inventing a valuation',()=>{
    const rows=deriveMeteoraNativeCashFlowEvidence({
      transactionId:'sig-1',position:'position-1',kind:'DEPOSIT',
      assets:[{currency:'TOKENX',amountMinor:100n},{currency:'TOKENY',amountMinor:200n}],
      observedAt:'2026-09-01T00:00:00Z',availableAt:'2026-09-01T00:00:01Z',evidenceIds:['tx:e1'],
    })
    expect(rows).toHaveLength(2)
    expect(rows.every(row=>row.amountSemantics==='NATIVE_TRANSFER')).toBe(true)
    expect(rows.every(row=>row.valuationEvidenceIds.length===0)).toBe(true)
    expect(rows.map(row=>row.currency).sort()).toEqual(['TOKENX','TOKENY'])
  })

  it('converts native flow to verified valuation only with matched amount and no-lookahead price evidence',()=>{
    const native=deriveMeteoraNativeCashFlowEvidence({
      transactionId:'sig-1',position:'position-1',kind:'WITHDRAWAL',assets:[{currency:'TOKENX',amountMinor:100n}],
      observedAt:'2026-09-01T00:00:10Z',availableAt:'2026-09-01T00:00:11Z',evidenceIds:['tx:e1'],
    })[0]!
    const valued=applyVerifiedMeteoraCashFlowValuation(native,{
      valuationId:'price-1',sourceCurrency:'TOKENX',targetCurrency:'USDC',sourceAmountMinor:100n,valuedAmountMinor:2500n,
      informationCutoff:'2026-09-01T00:00:09Z',observedAt:'2026-09-01T00:00:09Z',availableAt:'2026-09-01T00:00:12Z',evidenceIds:['price:e1'],
    })
    expect(valued).toMatchObject({currency:'USDC',amountMinor:2500n,amountSemantics:'VERIFIED_VALUATION',availableAt:'2026-09-01T00:00:12Z'})
    expect(valued.valuationEvidenceIds).toEqual(['price-1','price:e1'])
  })

  it('rejects valuation lookahead and amount mismatches',()=>{
    const native=deriveMeteoraNativeCashFlowEvidence({
      transactionId:'sig-1',position:'position-1',kind:'WITHDRAWAL',assets:[{currency:'TOKENX',amountMinor:100n}],
      observedAt:'2026-09-01T00:00:10Z',availableAt:'2026-09-01T00:00:11Z',evidenceIds:['tx:e1'],
    })[0]!
    expect(()=>applyVerifiedMeteoraCashFlowValuation(native,{
      valuationId:'future',sourceCurrency:'TOKENX',targetCurrency:'USDC',sourceAmountMinor:100n,valuedAmountMinor:2500n,
      informationCutoff:'2026-09-01T00:00:11Z',observedAt:'2026-09-01T00:00:09Z',availableAt:'2026-09-01T00:00:12Z',evidenceIds:['price:e1'],
    })).toThrow('lookahead')
    expect(()=>applyVerifiedMeteoraCashFlowValuation(native,{
      valuationId:'mismatch',sourceCurrency:'TOKENX',targetCurrency:'USDC',sourceAmountMinor:101n,valuedAmountMinor:2500n,
      informationCutoff:'2026-09-01T00:00:09Z',observedAt:'2026-09-01T00:00:09Z',availableAt:'2026-09-01T00:00:12Z',evidenceIds:['price:e1'],
    })).toThrow('source_mismatch')
  })
})
