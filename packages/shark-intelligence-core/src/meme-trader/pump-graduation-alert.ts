import type {PumpMigrationRadarCandidate} from './migration-radar'

/**
 * Read-only graduation radar. A crossing is a notification about research,
 * never advice to buy, a trade instruction, or proof the new pool is tradable.
 */
export type PumpGraduationAlertKind=
  'NEAR_CURVE'|'IMMINENT_CURVE'|'CURVE_COMPLETE_POOL_UNVERIFIED'|
  'POOL_MIGRATION_OBSERVED'|'RISK_BLOCKED'
export type PumpGraduationAlert=Readonly<{
  alertId:string
  mint:string
  quoteMint?:string
  bondingCurveAddress?:string
  kind:PumpGraduationAlertKind
  progressPercent?:number
  observedAt:string
  availableAt:string
  assessedAt:string
  candidateId:string
  sourceEvidenceIds:readonly string[]
  researchDisposition:'WATCH'|'REVIEW'|'BLOCK'
  blockers:readonly string[]
  missingChecks:readonly string[]
  paperFeasibility:'NOT_ASSESSED'|'PAPER_REVIEW_ONLY'|'BLOCKED'
  executableSellVerified:false
  authority:'OWNER_RESEARCH_ALERT_ONLY'
  canAuthorizeTrade:false
  canAutoSnipe:false
}>
export type PairedQuoteResearch=Readonly<{
  receiptId:string
  observedAt:string
  /** Existing WATCHKEEPER quote verdict only, NOT simulation or fill evidence. */
  source:'WATCHKEEPER_INDICATIVE_PAIR'
  hasForwardAndReverseQuotes:boolean
}>

const bucket=(c:PumpMigrationRadarCandidate):PumpGraduationAlertKind|null=>{
  if(c.stage==='DISCOVERED')return null
  if(c.disposition==='BLOCK')return 'RISK_BLOCKED'
  if(c.stage==='PUMPSWAP_MIGRATED')return 'POOL_MIGRATION_OBSERVED'
  if(c.stage==='CURVE_COMPLETE')return 'CURVE_COMPLETE_POOL_UNVERIFIED'
  if(c.graduationProgress===undefined||!Number.isFinite(c.graduationProgress))return null
  if(c.graduationProgress>=.98)return 'IMMINENT_CURVE'
  return c.graduationProgress>=.9?'NEAR_CURVE':null
}
const rank=(k:PumpGraduationAlertKind|null)=>({
  NEAR_CURVE:1,IMMINENT_CURVE:2,CURVE_COMPLETE_POOL_UNVERIFIED:3,
  POOL_MIGRATION_OBSERVED:4,RISK_BLOCKED:5,
} as const)[k!]??0

export function evaluatePumpGraduationAlert(input:Readonly<{
  current:PumpMigrationRadarCandidate
  previous?:PumpMigrationRadarCandidate
  assessedAt:string
  quoteResearch?:PairedQuoteResearch
  maxSignalAgeMs?:number
}>):PumpGraduationAlert|null{
  const {current:c,previous:p}=input
  const assessed=Date.parse(input.assessedAt),available=Date.parse(c.availableAt),observed=Date.parse(c.observedAt)
  const maxAge=input.maxSignalAgeMs??30_000
  if(!Number.isFinite(assessed)||!Number.isFinite(available)||!Number.isFinite(observed)||
    !Number.isFinite(maxAge)||maxAge<0||available<observed)
    throw new Error('shark_graduation_alert_clock_invalid')
  if(assessed<available)throw new Error('shark_graduation_alert_future_evidence')
  if(assessed-available>maxAge)return null
  if(!c.mint.trim()||!c.candidateId.trim()||!c.evidenceIds.length)throw new Error('shark_graduation_alert_identity_invalid')
  if(p&&p.mint!==c.mint)throw new Error('shark_graduation_alert_cross_mint')
  if(p&&Date.parse(p.availableAt)>available)throw new Error('shark_graduation_alert_reordered')
  const kind=bucket(c)
  if(!kind)return null
  const previousKind=p?bucket(p):null
  if(p&&rank(previousKind)>=rank(kind))return null
  const quote=input.quoteResearch
  let hasIndicativePairedQuote=false
  if(quote){
    const at=Date.parse(quote.observedAt)
    if(!quote.receiptId.trim()||quote.source!=='WATCHKEEPER_INDICATIVE_PAIR'||
      !Number.isFinite(at)||at>assessed)
      throw new Error('shark_graduation_alert_quote_invalid')
    hasIndicativePairedQuote=quote.hasForwardAndReverseQuotes&&assessed-at<=30_000
  }
  const paperFeasibility=c.disposition==='BLOCK'?'BLOCKED' as const:
    c.disposition==='WATCH'&&hasIndicativePairedQuote?'PAPER_REVIEW_ONLY' as const:'NOT_ASSESSED' as const
  return Object.freeze({
    alertId:`shark-graduation:${c.candidateId}:${kind}`,
    mint:c.mint,quoteMint:c.quoteMint,bondingCurveAddress:c.bondingCurveAddress,
    kind,
    progressPercent:c.graduationProgress===undefined?undefined:Math.round(c.graduationProgress*10_000)/100,
    observedAt:c.observedAt,availableAt:c.availableAt,assessedAt:input.assessedAt,
    candidateId:c.candidateId,
    sourceEvidenceIds:Object.freeze([...new Set(c.evidenceIds)].sort()),
    researchDisposition:c.disposition,blockers:Object.freeze([...c.blockers]),
    missingChecks:Object.freeze([...c.missingChecks]),
    paperFeasibility,executableSellVerified:false as const,
    authority:'OWNER_RESEARCH_ALERT_ONLY' as const,
    canAuthorizeTrade:false as const,canAutoSnipe:false as const,
  })
}

/** The caller must supply an owner-authenticated, commissioned notification transport.
 * No Telegram, browser, paid provider, or user identity is accessed by this module.
 */
export function formatOwnerPumpGraduationAlert(alert:PumpGraduationAlert):string {
  const pct=alert.progressPercent===undefined?'unknown':alert.progressPercent.toFixed(2)+'%'
  return [
    'SHARK | Pump graduation research alert',
    'Mint: '+alert.mint,
    'Stage: '+alert.kind+' | Curve progress: '+pct,
    'Research disposition: '+alert.researchDisposition,
    'Indicative paper feasibility: '+alert.paperFeasibility,
    'Risks: '+(alert.blockers.join(', ')||'not independently cleared'),
    'Missing checks: '+(alert.missingChecks.join(', ')||'none reported by radar'),
    'Source available: '+alert.availableAt,
    'Pool migration, sellability and executable profit are NOT confirmed by this alert.',
    'NO TRADE AUTHORITY. No automatic snipe.',
  ].join('\n')
}
export async function deliverOwnerPumpGraduationAlert(input:Readonly<{
  alert:PumpGraduationAlert
  ownerAuthenticated:boolean
  sendOwner:(message:string,deduplicationKey:string)=>Promise<void>
}>):Promise<void>{
  if(input.ownerAuthenticated!==true)throw new Error('shark_graduation_alert_owner_required')
  await input.sendOwner(formatOwnerPumpGraduationAlert(input.alert),input.alert.alertId)
}
