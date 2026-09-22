import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  MONEY_PROD_REQUIRED_LANES,
  certifyMoneyProdFinal,
  certifyMoneyShadowSoak,
  createMoneyProductionCommissioningReceipt,
  createMoneyProductionPlatformReceipt,
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

const platform=()=>[
  createMoneyProductionPlatformReceipt({kind:'DATABASE_SCHEMA',environment:'LIVE',passed:true,recordedAt:at,evidenceIds:['db:schema'],issuer:'OPERATIONS'}),
  createMoneyProductionPlatformReceipt({kind:'PRODUCTION_DEPLOYMENT',environment:'LIVE',passed:true,revision:'main:test',recordedAt:at,evidenceIds:['vercel:deploy'],issuer:'OPERATIONS'}),
]

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
  const report=certifyMoneyProdFinal({receipts,shadowSoak:soak(),platformReceipts:platform(),generatedAt:at})
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
  const report=certifyMoneyProdFinal({receipts,shadowSoak:soak(),platformReceipts:platform(),generatedAt:at})
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
  const report=certifyMoneyProdFinal({receipts,shadowSoak:soak(),platformReceipts:platform(),generatedAt:at})
  assert.equal(report.status,'PRODUCTION_ACCEPTED')
  assert.equal(report.productionAccepted,true)
  assert.ok(report.lanes.every(x=>x.status==='LIVE_ACCEPTED'))
  assert.equal(report.authority,'CERTIFICATION_ONLY')
  assert.equal(report.canExecute,false)

  const withoutSportsKill=receipts.filter(x=>!(x.lane==='SPORTS_BETTING'&&x.kind==='KILL_SWITCH'))
  const blocked=certifyMoneyProdFinal({receipts:withoutSportsKill,shadowSoak:soak(),platformReceipts:platform(),generatedAt:at})
  assert.equal(blocked.productionAccepted,false)
  assert.ok(blocked.blockers.includes('SPORTS_BETTING:BETTING_KILL_SWITCH_DRILL_REQUIRED'))
})

test('MONEY-PROD.5 certification receipts cannot carry execution authority',()=>{
  const r=receipt('STOCK','SOFTWARE_CERTIFICATION','jhadina','SHADOW')
  assert.equal(r.authority,'CERTIFICATION_ONLY');assert.equal(r.canExecute,false)
  const invalid={...r,authority:'EXECUTION' as const}
  assert.throws(()=>certifyMoneyProdFinal({receipts:[invalid as never],shadowSoak:soak(),platformReceipts:platform(),generatedAt:at}),/RECEIPT_AUTHORITY_FORBIDDEN/)
})

test('MONEY-PROD.6 commissioning migration is service-role only and stores no secrets',()=>{
  const migration=readFileSync(fileURLToPath(new URL('../migrations/015_production_commissioning_receipts.sql',import.meta.url)),'utf8')
  assert.match(migration,/FORCE ROW LEVEL SECURITY/)
  assert.match(migration,/REVOKE ALL ON money_production_commissioning_receipts FROM anon/)
  assert.match(migration,/REVOKE ALL ON money_production_commissioning_receipts FROM authenticated/)
  assert.match(migration,/GRANT SELECT, INSERT ON money_production_commissioning_receipts TO service_role/)
  assert.match(migration,/FORCE ROW LEVEL SECURITY[\s\S]*money_production_platform_receipts/)
  assert.match(migration,/REVOKE ALL ON money_production_platform_receipts FROM authenticated/)
  assert.match(migration,/GRANT SELECT, INSERT, DELETE ON money_production_platform_receipts TO service_role/)
  assert.doesNotMatch(migration,/private_key|secret_key|api_key|access_token/i)
  const productionMigration=readFileSync(fileURLToPath(new URL('../../../supabase/migrations/20260922022338_money_prod_final_commissioning_receipts.sql',import.meta.url)),'utf8')
  assert.match(productionMigration,/money_production_commissioning_receipts/)
  assert.match(productionMigration,/money_production_platform_receipts/)
  assert.match(productionMigration,/FORCE ROW LEVEL SECURITY/)
  assert.doesNotMatch(productionMigration,/private_key|secret_key|api_key|access_token/i)
})

test('MONEY-PROD.7 platform deployment and schema are independently required',()=>{
  const receipts=MONEY_PROD_REQUIRED_LANES.flatMap(lane=>{
    const provider:Record<MoneyProductionLane,string>={STOCK:'alpaca',FOREX:'fx-broker',SHARK_MEME:'dex-router',SPORTS_BETTING:'sportsbook-provider'}
    const rows=[receipt(lane,'SOFTWARE_CERTIFICATION','jhadina','SHADOW')]
    if(lane==='FOREX')rows.push(receipt(lane,'MARKET_DATA','finnhub','LIVE'))
    rows.push(receipt(lane,'PROVIDER_CONFIGURATION',provider[lane]),receipt(lane,'CREDENTIAL_VERIFICATION',provider[lane]),receipt(lane,'LIVE_CANARY',provider[lane]),receipt(lane,'RECONCILIATION',provider[lane]),receipt(lane,'KILL_SWITCH',provider[lane]))
    return rows
  })
  const noPlatform=certifyMoneyProdFinal({receipts,shadowSoak:soak(),platformReceipts:[],generatedAt:at})
  assert.equal(noPlatform.productionAccepted,false)
  assert.ok(noPlatform.blockers.includes('PLATFORM:COMMISSIONING_DATABASE_SCHEMA_REQUIRED'))
  assert.ok(noPlatform.blockers.includes('PLATFORM:CURRENT_PRODUCTION_DEPLOYMENT_REQUIRED'))
})


test('MONEY-PROD.7 live runtime substrate migration restores durable entitlement/canary/provider/paper stores',()=>{
  const migration=readFileSync(fileURLToPath(new URL('../migrations/016_live_runtime_substrate.sql',import.meta.url)),'utf8')
  for(const table of ['money_broker_account_entitlements','money_live_canary_state','money_live_canary_reservations','money_provider_execution_events','money_execution_outbox','money_paper_execution_events']) assert.match(migration,new RegExp('CREATE TABLE IF NOT EXISTS '+table))
  assert.match(migration,/FORCE ROW LEVEL SECURITY/)
  assert.match(migration,/REVOKE ALL ON TABLE %I FROM anon/)
  assert.match(migration,/REVOKE ALL ON TABLE %I FROM authenticated/)
  assert.match(migration,/GRANT SELECT, INSERT, UPDATE ON money_broker_account_entitlements TO service_role/)
  assert.match(migration,/GRANT SELECT, INSERT ON money_paper_execution_events TO service_role/)
  assert.doesNotMatch(migration,/private_key|secret_key|api_key|access_token/i)
})
