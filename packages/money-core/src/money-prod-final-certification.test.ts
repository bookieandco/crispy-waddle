import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MONEY_PROD_REQUIRED_LANES,
  certifyMoneyProdFinal,
  certifyMoneyShadowSoak,
  createMoneyProductionCommissioningReceipt,
  type MoneyProductionCommissioningReceipt,
  type MoneyProductionLane,
} from './money-production-commissioning.js'

const at='2026-09-22T02:00:00Z'
const soak=(overrides:Record<string,Partial<{sampleSize:number;resolvedSampleSize:number;maxDrawdownBps:number;unresolvedExecutions:number;duplicateExecutionCount:number;futureLeakCount:number;authorityEscalationCount:number;crossDomainTruthContaminationCount:number}>>={})=>certifyMoneyShadowSoak({
  domains:MONEY_PROD_REQUIRED_LANES.map(lane=>({
    lane,
    sampleSize:overrides[lane]?.sampleSize??100,
    resolvedSampleSize:overrides[lane]?.resolvedSampleSize??100,
    maxDrawdownBps:overrides[lane]?.maxDrawdownBps??500,
    unresolvedExecutions:overrides[lane]?.unresolvedExecutions??0,
    duplicateExecutionCount:overrides[lane]?.duplicateExecutionCount??0,
    futureLeakCount:overrides[lane]?.futureLeakCount??0,
    authorityEscalationCount:overrides[lane]?.authorityEscalationCount??0,
    crossDomainTruthContaminationCount:overrides[lane]?.crossDomainTruthContaminationCount??0,
    evidenceIds:['soak:'+lane],
  })),
  minimumSamplesPerLane:50,minimumResolutionRateBps:9000,maximumDrawdownBps:1500,
})

const receipt=(lane:MoneyProductionLane,kind:MoneyProductionCommissioningReceipt['kind'],provider:string,environment:MoneyProductionCommissioningReceipt['environment']='LIVE')=>
  createMoneyProductionCommissioningReceipt({lane,kind,provider,environment,passed:true,recordedAt:at,evidenceIds:[lane+':'+kind],issuer:kind==='SOFTWARE_CERTIFICATION'?'MONEY_CERTIFICATION':'OPERATIONS'})

test('MONEY-PROD.1 shadow soak rejects leakage, unresolved execution and truth contamination',()=>{
  assert.equal(soak().passed,true)
  const bad=soak({FOREX:{futureLeakCount:1},SHARK_MEME:{unresolvedExecutions:1},SPORTS_BETTING:{crossDomainTruthContaminationCount:1}})
  assert.equal(bad.passed,false)
  assert.ok(bad.reasonCodes.includes('FUTURE_LEAK:FOREX'))
  assert.ok(bad.reasonCodes.includes('UNRESOLVED_EXECUTIONS:SHARK_MEME'))
  assert.ok(bad.reasonCodes.includes('CROSS_DOMAIN_TRUTH_CONTAMINATION:SPORTS_BETTING'))
})

test('MONEY-PROD.2 software certification alone produces external commissioning required',()=>{
  const receipts=MONEY_PROD_REQUIRED_LANES.map(lane=>receipt(lane,'SOFTWARE_CERTIFICATION','jhadina','SHADOW'))
  const report=certifyMoneyProdFinal({receipts,shadowSoak:soak(),generatedAt:at})
  assert.equal(report.softwareComplete,true)
  assert.equal(report.productionAccepted,false)
  assert.equal(report.status,'SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED')
  assert.ok(report.blockers.includes('STOCK:ALPACA_PROVIDER_CONFIGURATION_REQUIRED'))
  assert.ok(report.blockers.includes('FOREX:FOREX_EXECUTION_PROVIDER_REQUIRED'))
  assert.ok(report.blockers.includes('SHARK_MEME:DEX_EXECUTION_PROVIDER_REQUIRED'))
  assert.ok(report.blockers.includes('SPORTS_BETTING:SPORTSBOOK_EXECUTION_PROVIDER_REQUIRED'))
})

test('MONEY-PROD.3 Finnhub market data can satisfy evidence but never forex execution provider',()=>{
  const receipts=[
    receipt('FOREX','SOFTWARE_CERTIFICATION','jhadina','SHADOW'),
    receipt('FOREX','MARKET_DATA','finnhub','LIVE'),
    receipt('FOREX','PROVIDER_CONFIGURATION','finnhub','LIVE'),
    receipt('STOCK','SOFTWARE_CERTIFICATION','jhadina','SHADOW'),
    receipt('SHARK_MEME','SOFTWARE_CERTIFICATION','jhadina','SHADOW'),
    receipt('SPORTS_BETTING','SOFTWARE_CERTIFICATION','jhadina','SHADOW'),
  ]
  const report=certifyMoneyProdFinal({receipts,shadowSoak:soak(),generatedAt:at})
  const fx=report.lanes.find(x=>x.lane==='FOREX')!
  assert.ok(fx.reasonCodes.includes('FINNHUB_CANNOT_EXECUTE'))
  assert.notEqual(fx.status,'LIVE_ACCEPTED')
})

test('MONEY-PROD.4 every lane requires independent live receipts before final acceptance',()=>{
  const provider:Record<MoneyProductionLane,string>={STOCK:'alpaca',FOREX:'fx-broker',SHARK_MEME:'dex-router',SPORTS_BETTING:'sportsbook-provider'}
  const receipts:MoneyProductionCommissioningReceipt[]=[]
  for(const lane of MONEY_PROD_REQUIRED_LANES){
    receipts.push(receipt(lane,'SOFTWARE_CERTIFICATION','jhadina','SHADOW'))
    if(lane==='FOREX')receipts.push(receipt(lane,'MARKET_DATA','finnhub','LIVE'))
    receipts.push(receipt(lane,'PROVIDER_CONFIGURATION',provider[lane]))
    receipts.push(receipt(lane,'CREDENTIAL_VERIFICATION',provider[lane]))
    receipts.push(receipt(lane,'LIVE_CANARY',provider[lane]))
    receipts.push(receipt(lane,'RECONCILIATION',provider[lane]))
    receipts.push(receipt(lane,'KILL_SWITCH',provider[lane]))
  }
  const report=certifyMoneyProdFinal({receipts,shadowSoak:soak(),generatedAt:at})
  assert.equal(report.status,'PRODUCTION_ACCEPTED')
  assert.equal(report.productionAccepted,true)
  assert.ok(report.lanes.every(x=>x.status==='LIVE_ACCEPTED'))
  assert.equal(report.authority,'CERTIFICATION_ONLY')
  assert.equal(report.canExecute,false)

  const withoutSportsKill=receipts.filter(x=>!(x.lane==='SPORTS_BETTING'&&x.kind==='KILL_SWITCH'))
  const blocked=certifyMoneyProdFinal({receipts:withoutSportsKill,shadowSoak:soak(),generatedAt:at})
  assert.equal(blocked.productionAccepted,false)
  assert.ok(blocked.blockers.includes('SPORTS_BETTING:BETTING_KILL_SWITCH_DRILL_REQUIRED'))
})

test('MONEY-PROD.5 certification receipts cannot carry execution authority',()=>{
  const r=receipt('STOCK','SOFTWARE_CERTIFICATION','jhadina','SHADOW')
  assert.equal(r.authority,'CERTIFICATION_ONLY');assert.equal(r.canExecute,false)
  const invalid={...r,authority:'EXECUTION' as const}
  assert.throws(()=>certifyMoneyProdFinal({receipts:[invalid as never],shadowSoak:soak(),generatedAt:at}),/RECEIPT_AUTHORITY_FORBIDDEN/)
})
