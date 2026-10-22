import {describe,it,expect} from 'vitest'
import {auditCommissionObservations,auditCommissionPaper,evaluateCommissionAcceptance} from '../shark-commission-27-32'
const mint='2'.repeat(32),pair='3'.repeat(32)
const discovery={source:'PUBLIC_POLL' as const,mint,pairAddress:pair,
 providerAvailableAt:'2026-10-21T19:00:00Z',locallyIngestedAt:'2026-10-21T19:00:01Z',
 sourceEvidenceId:'provider-public-receipt',protocolVerified:false,
 chainEvidenceIndependentlyVerified:false}
describe('SHARK-COMMISSION.27–.32 fail-closed research integration',()=>{
 it('binds observation to original mint/pair and keeps polling chronology unknown',()=>{
  const report=auditCommissionObservations([{mint,pairAddress:pair,observationReceipt:discovery,
    firstSeenAt:'2026-10-21T19:00:02Z',receiptId:'original-source'}])
  expect(report.discovered).toBe(1)
  expect(report.missingRiskCoverage).toBe(1)
  expect(report.pollOnly).toBe(1)
  expect(report.realStreamObservations).toBe(0)
  expect(report.canExecute).toBe(false)
  expect(()=>auditCommissionObservations([{mint,pairAddress:'4'.repeat(32),
    observationReceipt:discovery,firstSeenAt:'2026-10-21T19:00:02Z',
    receiptId:'forged-pair'}])).toThrow('cross_asset')
  expect(()=>auditCommissionObservations([{mint,pairAddress:pair,
    observationReceipt:discovery,firstSeenAt:'2026-10-21T18:59:59Z',
    receiptId:'backdated'}])).toThrow('lookahead')
 })
 it('uses prospectively captured Alpha outcomes, not fill returns',()=>{
  const report=auditCommissionPaper({launches:[],selections:[],outcomes:[],
    asOf:'2026-10-22T19:00:00Z',canaries:[],marks:[],routes:[]})
  expect(report.observedLaunches).toBe(0)
  expect(report.verifiedMoneyFills).toBe(0)
  expect(report.estimatedExecutableReturn).toBe(false)
  expect(report.noLiveOrders).toBe(true)
 })
 it('refuses source CI promotion to a live host or capital permission',()=>{
  const report=evaluateCommissionAcceptance({
    exactHeadCiPassed:true,mergeReconciled:false,sourceReadOnlyHostCommissioned:false,
    phoneReadbackVerified:false,providerFeeDefinitionsVerified:false,
    independentlyProvenSellability:false,realProspectiveCasesVerified:false,
    moneyCoreReviewCompleted:false,pairs:[],traces:[],
  })
  expect(report.status).toBe('NOT_COMMISSIONED')
  expect(report.blockers).toContain('persistent-read-only-host-not-commissioned')
  expect(report.blockers).toContain('no-real-prospective-coin-observations')
  expect(report.noDeployment).toBe(true)
  expect(report.noSpend).toBe(true)
  expect(report.noSign).toBe(true)
  expect(report.noLiveTrading).toBe(true)
 })
})
