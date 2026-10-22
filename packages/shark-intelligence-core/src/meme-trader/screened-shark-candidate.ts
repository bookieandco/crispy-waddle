import type {MemeTradeAssessment} from './assessment'
import type {SharkDiscoveryScreen} from './stage-aware-discovery-screen'

/**
 * Composes the canonical SHARK assessment with the cheap source-derived screen.
 * Does not create a second risk engine or bypass Money Core.
 */
export type ScreenedSharkCandidate=Readonly<{
  candidateId:string
  screen:SharkDiscoveryScreen
  assessmentId?:string
  disposition:'SKIP'|'REVIEW'|'BLOCKED'|'WATCH_RESEARCH_ONLY'
  reasons:readonly string[]
  evidenceIds:readonly string[]
  authority:'SHARK_INTELLIGENCE_ONLY'
  canAuthorizeTrade:false
  canCallSigner:false
}>
export function composeScreenedSharkCandidate(input:{
  screen:SharkDiscoveryScreen
  assessment?:MemeTradeAssessment
  /** Time by which the assessment actually became available. */
  assessmentAvailableAt?:string
  informationCutoff:string
}):ScreenedSharkCandidate{
  const cutoff=Date.parse(input.informationCutoff)
  if(!Number.isFinite(cutoff))throw new Error('shark_screened_cutoff_invalid')
  const {screen,assessment}=input
  if(screen.authority!=='DISCOVERY_RESEARCH_ONLY'||screen.canAuthorizeTrade!==false||
     screen.canLabelRug!==false||!screen.evidenceIds.length)throw new Error('shark_screened_untrusted_screen')
  if(assessment){
    if(assessment.token.chainId!=='solana'||assessment.token.tokenAddress!==screen.mint)
      throw new Error('shark_screened_mint_mismatch')
    if(!input.assessmentAvailableAt)throw new Error('shark_screened_assessment_availability_required')
    const assessed=Date.parse(assessment.assessedAt)
    const available=Date.parse(input.assessmentAvailableAt)
    if(!Number.isFinite(assessed)||!Number.isFinite(available)||available<assessed||available>cutoff)
      throw new Error('shark_screened_assessment_chronology_invalid')
    if(!assessment.evidenceIds.length)throw new Error('shark_screened_assessment_evidence_missing')
  }
  const reasons:string[]=[]
  let disposition:ScreenedSharkCandidate['disposition']='REVIEW'
  if(screen.disposition==='BLOCKED'){disposition='BLOCKED';reasons.push(...screen.defensiveBlockReasons)}
  else if(screen.disposition==='SKIP'){disposition='SKIP';reasons.push(...screen.failedRules.map(r=>'discovery-filter-failed:'+r))}
  else if(screen.disposition==='REVIEW'){reasons.push(...screen.missingRules.map(r=>'discovery-input-missing:'+r))}
  else if(!assessment){reasons.push('canonical-assessment-missing')}
  else if(assessment.rugProtection.disposition==='BLOCK'||
    assessment.riskAssessment.band==='blocked'||
    ['QUARANTINE','BLOCK_NEW_ENTRY','EXIT_RECOMMENDED'].includes(assessment.rugSelfProtection?.action??'')){
    disposition='BLOCKED';reasons.push('canonical-defensive-veto')
  }else if(assessment.rugProtection.disposition!=='ALLOW_CANDIDATE'||
    assessment.riskAssessment.band!=='candidate'||
    assessment.rugSelfProtection?.action!=='ALLOW_PAPER_STUDY'||
    assessment.rugSelfProtection.missingCriticalCoverage.length>0){
    reasons.push('independent-safety-coverage-or-risk-review')
  }else{
    disposition='WATCH_RESEARCH_ONLY';reasons.push('screened-and-reviewed-not-authorized')
  }
  return Object.freeze({
    candidateId:'shark-screened:'+screen.presetId+':'+screen.mint,
    screen,assessmentId:assessment?.assessmentId,disposition,
    reasons:Object.freeze([...new Set(reasons)].sort()),
    evidenceIds:Object.freeze([...new Set([...screen.evidenceIds,...(assessment?.evidenceIds??[])])].sort()),
    authority:'SHARK_INTELLIGENCE_ONLY',canAuthorizeTrade:false,canCallSigner:false,
  })
}
