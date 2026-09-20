import { evaluateCommercialDeal, type CommercialAssumptions, type CommercialDealGate } from './commercial-deal-gate.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import type { ProviderNegotiationState } from './provider-negotiation.js'

export type CommercialReconciliation = {
  opportunityId: string
  previous: CommercialDealGate
  reconciled: CommercialDealGate
  negotiatedProviderCosts: Record<string, number>
  deltas: {
    providerCost: number
    grossProfit: number
    marginPercent: number
  }
  changedProviderIds: string[]
  changedScopeProviderIds: string[]
  status: 'blocked' | 'requires_reapproval' | 'reconciled'
  reapprovalRequired: boolean
  reasons: string[]
}

export function reconcileNegotiatedCommercialTerms(
  plan: FulfillmentPlan,
  previous: CommercialDealGate,
  negotiations: ProviderNegotiationState[],
  assumptions: CommercialAssumptions,
): CommercialReconciliation {
  if(previous.opportunityId!==plan.opportunityId) throw new Error('Previous commercial gate does not match fulfillment plan')
  const providerCosts={...(assumptions.providerCosts??{})}
  const changedProviderIds:string[]=[]
  const changedScopeProviderIds:string[]=[]
  const reasons:string[]=[]

  for(const state of negotiations){
    if(state.opportunityId!==plan.opportunityId) throw new Error('Negotiation opportunity does not match fulfillment plan')
    if(state.status!=='provisional_terms'||!state.provisionalTerms) continue
    const assignment=plan.assignments.find(a=>a.providerId===state.providerId)
    if(!assignment) throw new Error(`Negotiated provider is not assigned in fulfillment plan: ${state.providerId}`)
    if(state.provisionalTerms.providerCost!==undefined){
      const before=providerCosts[state.providerId]
      providerCosts[state.providerId]=state.provisionalTerms.providerCost
      if(before!==state.provisionalTerms.providerCost) changedProviderIds.push(state.providerId)
    }
    const baseline=[...assignment.requirementIds].sort().join('|')
    const negotiated=[...state.provisionalTerms.requirementIds].sort().join('|')
    if(baseline!==negotiated) changedScopeProviderIds.push(state.providerId)
  }

  const reconciled=evaluateCommercialDeal(plan,{...assumptions,providerCosts},previous.structure)
  const deltas={
    providerCost:reconciled.economics.providerCost-previous.economics.providerCost,
    grossProfit:reconciled.economics.estimatedGrossProfit-previous.economics.estimatedGrossProfit,
    marginPercent:Math.round((reconciled.economics.estimatedMarginPercent-previous.economics.estimatedMarginPercent)*100)/100,
  }
  if(changedProviderIds.length) reasons.push('Negotiated provider pricing changed from the prior commercial model.')
  if(changedScopeProviderIds.length) reasons.push('Negotiated scope allocation changed from the fulfillment-plan baseline and requires a rebuilt fulfillment plan.')
  if(reconciled.status==='blocked') reasons.push('Reconciled economics no longer satisfy the commercial gate.')

  const reapprovalRequired=changedProviderIds.length>0||changedScopeProviderIds.length>0||deltas.grossProfit!==0||deltas.marginPercent!==0
  const status:CommercialReconciliation['status']=reconciled.status==='blocked'||changedScopeProviderIds.length>0?'blocked':reapprovalRequired?'requires_reapproval':'reconciled'
  return {
    opportunityId:plan.opportunityId,previous,reconciled,negotiatedProviderCosts:providerCosts,deltas,
    changedProviderIds:[...new Set(changedProviderIds)],
    changedScopeProviderIds:[...new Set(changedScopeProviderIds)],
    status,reapprovalRequired,reasons,
  }
}
