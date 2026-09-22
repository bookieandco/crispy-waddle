import { createHash } from 'node:crypto'
import { createMoneyProductionCommissioningReceipt,type MoneyProductionCommissioningReceipt,type MoneyProductionLane } from './money-production-commissioning.js'

export type MoneyProdSoftwareCaseName=
  |'stock-point-in-time-reality'
  |'stock-chart-vision-research-only'
  |'stock-alpaca-live-adapter'
  |'autonomous-mandate-action-core'
  |'autonomous-hard-risk-limits'
  |'single-use-permit-replay-block'
  |'provider-account-entitlement'
  |'unknown-execution-reconciliation'
  |'global-kill-switch'
  |'forex-point-in-time-reality'
  |'forex-finnhub-read-only-market-data'
  |'forex-vision-opaque-until-calibrated'
  |'forex-learning-paper-shadow'
  |'shark-money-research-isolation'
  |'shark-paper-learning'
  |'shark-no-protected-fund-authority'
  |'sports-prediction-research-isolation'
  |'sports-native-paper-wager-settlement'
  |'sports-learning-no-betting-authority'
  |'cross-domain-learning-no-truth-contamination'
  |'commissioning-receipt-ledger-service-only'

export type MoneyProdSoftwareCase=Readonly<{
  name:MoneyProdSoftwareCaseName
  passed:boolean
  evidenceIds:readonly string[]
}>

export type MoneyProdSoftwareCertification=Readonly<{
  certificationId:string
  passed:boolean
  cases:readonly MoneyProdSoftwareCase[]
  missingCases:readonly MoneyProdSoftwareCaseName[]
  laneReceiptCandidates:readonly MoneyProductionCommissioningReceipt[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const REQUIRED:readonly MoneyProdSoftwareCaseName[]=Object.freeze([
  'stock-point-in-time-reality','stock-chart-vision-research-only','stock-alpaca-live-adapter','autonomous-mandate-action-core','autonomous-hard-risk-limits','single-use-permit-replay-block','provider-account-entitlement','unknown-execution-reconciliation','global-kill-switch',
  'forex-point-in-time-reality','forex-finnhub-read-only-market-data','forex-vision-opaque-until-calibrated','forex-learning-paper-shadow',
  'shark-money-research-isolation','shark-paper-learning','shark-no-protected-fund-authority',
  'sports-prediction-research-isolation','sports-native-paper-wager-settlement','sports-learning-no-betting-authority',
  'cross-domain-learning-no-truth-contamination','commissioning-receipt-ledger-service-only',
])

const LANE_CASES:Readonly<Record<MoneyProductionLane,readonly MoneyProdSoftwareCaseName[]>>=Object.freeze({
  STOCK:Object.freeze<MoneyProdSoftwareCaseName[]>(['stock-point-in-time-reality','stock-chart-vision-research-only','stock-alpaca-live-adapter','autonomous-mandate-action-core','autonomous-hard-risk-limits','single-use-permit-replay-block','provider-account-entitlement','unknown-execution-reconciliation','global-kill-switch']),
  FOREX:Object.freeze<MoneyProdSoftwareCaseName[]>(['forex-point-in-time-reality','forex-finnhub-read-only-market-data','forex-vision-opaque-until-calibrated','forex-learning-paper-shadow','autonomous-mandate-action-core','autonomous-hard-risk-limits','single-use-permit-replay-block','unknown-execution-reconciliation','global-kill-switch']),
  SHARK_MEME:Object.freeze<MoneyProdSoftwareCaseName[]>(['shark-money-research-isolation','shark-paper-learning','shark-no-protected-fund-authority','autonomous-mandate-action-core','autonomous-hard-risk-limits','single-use-permit-replay-block','unknown-execution-reconciliation','global-kill-switch']),
  SPORTS_BETTING:Object.freeze<MoneyProdSoftwareCaseName[]>(['sports-prediction-research-isolation','sports-native-paper-wager-settlement','sports-learning-no-betting-authority','cross-domain-learning-no-truth-contamination']),
})

export function certifyMoneyProdSoftware(input:{cases:readonly MoneyProdSoftwareCase[];certifiedAt:string}):MoneyProdSoftwareCertification{
  if(Number.isNaN(Date.parse(input.certifiedAt)))throw new Error('MONEY_PROD_SOFTWARE_TIME_INVALID')
  const byName=new Map<MoneyProdSoftwareCaseName,MoneyProdSoftwareCase>()
  for(const c of input.cases){
    if(byName.has(c.name))throw new Error('MONEY_PROD_SOFTWARE_DUPLICATE_CASE:'+c.name)
    if(!c.evidenceIds.length)throw new Error('MONEY_PROD_SOFTWARE_CASE_EVIDENCE_REQUIRED:'+c.name)
    byName.set(c.name,Object.freeze({...c,evidenceIds:Object.freeze([...new Set(c.evidenceIds)].sort())}))
  }
  const missingCases=Object.freeze(REQUIRED.filter(name=>!byName.get(name)?.passed))
  const passed=missingCases.length===0
  const laneReceiptCandidates:MoneyProductionCommissioningReceipt[]=[]
  if(passed){
    for(const [lane,names] of Object.entries(LANE_CASES) as [MoneyProductionLane,readonly MoneyProdSoftwareCaseName[]][]){
      const evidenceIds=Object.freeze([...new Set(names.flatMap(name=>byName.get(name)?.evidenceIds??[]))].sort())
      laneReceiptCandidates.push(createMoneyProductionCommissioningReceipt({lane,kind:'SOFTWARE_CERTIFICATION',provider:'jhadina-money-core',environment:'SHADOW',passed:true,recordedAt:input.certifiedAt,evidenceIds,issuer:'MONEY_CERTIFICATION'}))
    }
  }
  return Object.freeze({
    certificationId:'money-prod-software:'+hash({cases:[...byName.values()].map(x=>({name:x.name,passed:x.passed,evidenceIds:x.evidenceIds})).sort((a,b)=>a.name.localeCompare(b.name)),certifiedAt:input.certifiedAt}),
    passed,cases:Object.freeze([...byName.values()]),missingCases,laneReceiptCandidates:Object.freeze(laneReceiptCandidates),authority:'CERTIFICATION_ONLY',canExecute:false,
  })
}

export function requiredMoneyProdSoftwareCases():readonly MoneyProdSoftwareCaseName[]{return REQUIRED}
