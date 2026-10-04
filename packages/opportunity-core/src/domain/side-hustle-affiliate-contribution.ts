import type {Opportunity} from './opportunity.js'
import {
  calculateOpportunityOutcome,
  type OpportunityOutcome,
} from './outcome.js'
import {
  latestSideHustleAffiliateStates,
} from './side-hustle-affiliate-portfolio.js'
import type {
  SideHustleAffiliateEvent,
} from './side-hustle-commerce.js'
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
} from './side-hustle-experiment.js'
import {isSideHustleProfile} from './side-hustles.js'

export type AffiliateContributionProofStatus='passed'|'blocked'

export type AffiliateContributionProof={
  id:string
  opportunityId:string
  experimentId:string
  currency:string
  status:AffiliateContributionProofStatus
  calculation:OpportunityOutcome
  payoutEventIds:string[]
  reversalEventIds:string[]
  programRefs:string[]
  blockers:string[]
  evidenceRefs:string[]
  evaluatedAt:string
  canonicalOutcomePersisted:false
  authority:'AFFILIATE_CONTRIBUTION_ANALYTICS_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export function buildAffiliateContributionProof(input:{
  opportunity:Opportunity
  experiment:SideHustleExperiment
  evaluation:SideHustleExperimentEvaluation
  affiliateEvents:readonly SideHustleAffiliateEvent[]
  currency:string
  evaluatedAt:string
}):AffiliateContributionProof{
  const profile=input.opportunity.metadata?.sideHustleProfile
  if(!isSideHustleProfile(profile)||profile.family!=='commerce_affiliate'){
    throw new Error('Affiliate contribution proof requires commerce_affiliate Opportunity')
  }
  if(input.experiment.opportunityId!==input.opportunity.id){
    throw new Error('Affiliate contribution experiment does not belong to opportunity')
  }
  if(input.experiment.profile.family!=='commerce_affiliate'){
    throw new Error('Affiliate contribution experiment must be commerce_affiliate')
  }
  if(input.experiment.status!=='completed'||!input.experiment.startedAt||!input.experiment.completedAt){
    throw new Error('Affiliate contribution proof requires a completed experiment window')
  }
  if(input.evaluation.experimentId!==input.experiment.id||
     input.evaluation.opportunityId!==input.opportunity.id){
    throw new Error('Affiliate contribution evaluation does not match experiment')
  }

  const evaluatedAt=normalizeDate(input.evaluatedAt,'affiliateContribution.evaluatedAt')
  const startedAt=normalizeDate(input.experiment.startedAt,'affiliateContribution.startedAt')
  const completedAt=normalizeDate(input.experiment.completedAt,'affiliateContribution.completedAt')
  if(Date.parse(completedAt)<Date.parse(startedAt)){
    throw new Error('Affiliate contribution experiment window is invalid')
  }
  if(Date.parse(evaluatedAt)<Date.parse(completedAt)){
    throw new Error('Affiliate contribution cannot be evaluated before experiment completion')
  }
  if(Date.parse(input.evaluation.evaluatedAt)>Date.parse(evaluatedAt)){
    throw new Error('Affiliate contribution cannot use a future experiment evaluation')
  }

  const currency=requireCurrency(input.currency)
  if(input.experiment.currency.trim().toUpperCase()!==currency){
    throw new Error('Affiliate contribution currency must match experiment currency; FX inference is not allowed')
  }

  const canonical=latestSideHustleAffiliateStates(
    input.affiliateEvents.map(event=>({...event})),
  )
  if(canonical.some(event=>event.opportunityId!==input.opportunity.id)){
    throw new Error('Affiliate contribution events must belong to one opportunity')
  }

  const blockers:string[]=[]
  if(input.evaluation.decision!=='promote'){
    blockers.push(`bounded experiment decision is ${input.evaluation.decision}, not promote`)
  }
  if(input.evaluation.observationCount<1){
    blockers.push('bounded experiment has no observations')
  }

  const conversions=canonical.filter(event=>event.kind==='conversion')
  const payoutCandidates=canonical.filter(event=>
    event.kind==='payout'&&
    event.economicState==='paid'&&
    event.currency===currency&&
    typeof event.amount==='number'&&
    event.amount>0&&
    event.providerRef==='provider:partnerize'&&
    event.metadata?.settlement_basis==='paid_selfbill_item_no_fx_no_tax'
  )

  const eligiblePayouts:SideHustleAffiliateEvent[]=[]
  for(const payout of payoutCandidates){
    const conversionAt=parseOptionalDate(payout.metadata?.conversion_at)
    if(!conversionAt){
      blockers.push(`payout ${payout.id} lacks conversion-time attribution`)
      continue
    }
    if(Date.parse(conversionAt)<Date.parse(startedAt)||
       Date.parse(conversionAt)>Date.parse(completedAt)){
      continue
    }

    const conversionId=payout.metadata?.conversion_id?.trim()
    if(!conversionId){
      blockers.push(`payout ${payout.id} lacks conversion identity`)
      continue
    }
    const expectedExternalRef=`partnerize:conversion:${conversionId}`
    const conversion=conversions.find(event=>
      event.providerRef===payout.providerRef&&
      event.programRef===payout.programRef&&
      event.externalEventRef===expectedExternalRef
    )
    if(!conversion){
      blockers.push(`payout ${payout.id} lacks canonical conversion state`)
      continue
    }
    if(!['approved','paid'].includes(conversion.economicState??'unknown')){
      blockers.push(
        `payout ${payout.id} conversion state is ${conversion.economicState??'unknown'}`,
      )
      continue
    }
    eligiblePayouts.push(payout)
  }

  const programRefs=unique(eligiblePayouts.map(event=>event.programRef))
  const reversals=canonical.filter(event=>
    event.kind==='reversal'&&
    event.currency===currency&&
    typeof event.amount==='number'&&
    event.amount>0&&
    programRefs.includes(event.programRef)&&
    Date.parse(event.occurredAt)>=Date.parse(startedAt)&&
    Date.parse(event.occurredAt)<=Date.parse(evaluatedAt)
  )

  const grossRevenue=roundMoney(sum(eligiblePayouts.map(event=>event.amount??0)))
  const refunds=roundMoney(sum(reversals.map(event=>event.amount??0)))
  const evidenceRefs=unique([
    ...input.experiment.evidenceRefs,
    ...input.evaluation.evidenceRefs,
    ...eligiblePayouts.flatMap(event=>event.evidenceRefs),
    ...reversals.flatMap(event=>event.evidenceRefs),
  ])
  if(grossRevenue<=0){
    blockers.push('no attributable paid affiliate revenue exists for the experiment window')
  }

  const base={
    id:affiliateContributionProofId(input.experiment.id,currency,completedAt),
    opportunityId:input.opportunity.id,
    currency,
    grossRevenue,
    refunds,
    directCosts:roundMoney(input.evaluation.totalSpend),
    fees:0,
    hours:roundMoney(input.evaluation.totalHours),
    sourceOwner:'commerce' as const,
    evidenceRefs:evidenceRefs.length?evidenceRefs:[input.experiment.id],
    transactionRefs:unique([
      ...eligiblePayouts.map(event=>event.externalEventRef),
      ...reversals.map(event=>event.externalEventRef),
    ]),
    observedAt:evaluatedAt,
    notes:'Bounded affiliate contribution calculation only; does not close the ongoing Opportunity.',
  }

  let calculation=calculateOpportunityOutcome({...base,result:'won'})
  if(calculation.profit<=0){
    calculation=calculateOpportunityOutcome({...base,result:'lost'})
    blockers.push(
      `non-positive contribution: ${calculation.profit.toFixed(2)} ${currency}`,
    )
  }

  const status:AffiliateContributionProofStatus=
    blockers.length===0&&calculation.profit>0?'passed':'blocked'

  return{
    id:base.id,
    opportunityId:input.opportunity.id,
    experimentId:input.experiment.id,
    currency,
    status,
    calculation,
    payoutEventIds:eligiblePayouts.map(event=>event.id),
    reversalEventIds:reversals.map(event=>event.id),
    programRefs,
    blockers:unique(blockers),
    evidenceRefs:base.evidenceRefs,
    evaluatedAt,
    canonicalOutcomePersisted:false,
    authority:'AFFILIATE_CONTRIBUTION_ANALYTICS_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function affiliateContributionProofId(
  experimentId:string,
  currency:string,
  completedAt:string,
):string{
  return `affiliate-contribution:${sanitize(experimentId)}:${currency}:${sanitize(completedAt)}`
}

function sanitize(value:string):string{
  return value.replace(/[^0-9A-Za-z:_-]/g,'').slice(-96)
}

function parseOptionalDate(value?:string):string|undefined{
  if(!value)return undefined
  const parsed=Date.parse(value)
  return Number.isFinite(parsed)?new Date(parsed).toISOString():undefined
}

function normalizeDate(value:string,field:string):string{
  const parsed=Date.parse(value)
  if(!Number.isFinite(parsed))throw new Error(`${field} must be a valid date`)
  return new Date(parsed).toISOString()
}

function requireCurrency(value:string):string{
  const currency=value.trim().toUpperCase()
  if(!/^[A-Z]{3}$/.test(currency))throw new Error('Affiliate contribution currency must be a 3-letter code')
  return currency
}

function sum(values:number[]):number{
  return values.reduce((total,value)=>total+value,0)
}

function roundMoney(value:number):number{
  return Math.round((value+Number.EPSILON)*100)/100
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}
