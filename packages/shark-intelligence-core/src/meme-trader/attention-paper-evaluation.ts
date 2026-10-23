/**
 * SHARK-ATTENTION.06: paired prospective paper ablation.
 * Returns are injected hypothetical NET assumptions, not observed fills or
 * proof of alpha. This never learns/promotes a strategy automatically.
 */
export type AttentionPaperPair=Readonly<{
  caseId:string
  subjectMint:string
  decisionAt:string
  featureAvailableAt:string
  outcomeObservedAt:string
  evidenceIds:readonly string[]
  baselineNetReturnBps:number
  attentionNetReturnBps:number
  netReturnBasis:'HYPOTHETICAL_PAPER_COST_ASSUMPTIONS'
}>

export type AttentionPaperComparison=Readonly<{
  schema:'SHARK_ATTENTION_PAIRED_PAPER_V1'
  sampleCount:number
  averageBaselineNetBps:number|null
  averageAttentionNetBps:number|null
  averageDeltaBps:number|null
  attentionBetterFraction:number|null
  verdict:'NO_SAMPLES'|'DESCRIPTIVE_ONLY_NOT_VALIDATED'
  returnEvidence:'HYPOTHETICAL_NOT_ACTUAL_FILLS'
  independentlyValidated:false
  canPromoteStrategy:false
  canExecute:false
}>

const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const millis=(x:string)=>{
  if(typeof x!=='string'||!x.endsWith('Z')||!Number.isFinite(Date.parse(x)))
    throw new Error('ATTENTION_PAPER_TIME_INVALID')
  return Date.parse(x)
}
const ret=(x:number)=>typeof x==='number'&&Number.isFinite(x)&&x>=-10000&&x<=1000000

export function compareAttentionPaperPairs(rows:readonly AttentionPaperPair[]):AttentionPaperComparison{
  if(!Array.isArray(rows)||rows.length>10000)throw new Error('ATTENTION_PAPER_BATCH_INVALID')
  const ids=new Set<string>()
  let base=0,attention=0,better=0
  for(const r of rows){
    if(!r||typeof r!=='object'||typeof r.caseId!=='string'||!r.caseId||r.caseId.length>256||
       ids.has(r.caseId)||!MINT.test(r.subjectMint)||
       r.netReturnBasis!=='HYPOTHETICAL_PAPER_COST_ASSUMPTIONS'||
       !Array.isArray(r.evidenceIds)||!r.evidenceIds.length||
       r.evidenceIds.some((x:unknown)=>typeof x!=='string'||!x||x.length>256)||
       !ret(r.baselineNetReturnBps)||!ret(r.attentionNetReturnBps))
      throw new Error('ATTENTION_PAPER_CASE_INVALID')
    const feature=millis(r.featureAvailableAt),decision=millis(r.decisionAt),
      outcome=millis(r.outcomeObservedAt)
    if(feature>decision||outcome<=decision)throw new Error('ATTENTION_PAPER_LOOKAHEAD_OR_OUTCOME_INVALID')
    ids.add(r.caseId)
    base+=r.baselineNetReturnBps
    attention+=r.attentionNetReturnBps
    if(r.attentionNetReturnBps>r.baselineNetReturnBps)better++
  }
  const count=rows.length
  return Object.freeze({
    schema:'SHARK_ATTENTION_PAIRED_PAPER_V1' as const,
    sampleCount:count,
    averageBaselineNetBps:count?base/count:null,
    averageAttentionNetBps:count?attention/count:null,
    averageDeltaBps:count?(attention-base)/count:null,
    attentionBetterFraction:count?better/count:null,
    verdict:count?'DESCRIPTIVE_ONLY_NOT_VALIDATED' as const:'NO_SAMPLES' as const,
    returnEvidence:'HYPOTHETICAL_NOT_ACTUAL_FILLS' as const,
    independentlyValidated:false as const,canPromoteStrategy:false as const,canExecute:false as const,
  })
}
