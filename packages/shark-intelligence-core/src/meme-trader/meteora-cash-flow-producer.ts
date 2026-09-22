import type { MeteoraDlmmCashFlowEvidence } from './meteora-profitability-evidence'

export type MeteoraNativeCashFlowAsset=Readonly<{
  currency:string
  amountMinor:bigint
}>

export type MeteoraTransactionCashFlowInput=Readonly<{
  transactionId:string
  position:string
  kind:'DEPOSIT'|'WITHDRAWAL'|'FEE'
  assets:readonly MeteoraNativeCashFlowAsset[]
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
}>

export type MeteoraCashFlowValuationEvidence=Readonly<{
  valuationId:string
  sourceCurrency:string
  targetCurrency:string
  sourceAmountMinor:bigint
  valuedAmountMinor:bigint
  informationCutoff:string
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
}>

const assertIso=(value:string,code:string)=>{if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)}
const later=(a:string,b:string)=>Date.parse(a)>=Date.parse(b)?a:b

export function deriveMeteoraNativeCashFlowEvidence(input:MeteoraTransactionCashFlowInput):MeteoraDlmmCashFlowEvidence[]{
  if(!input.transactionId.trim()||!input.position.trim()||!input.evidenceIds.length)throw new Error('meteora_cash_flow_producer_identity_required')
  if(!['DEPOSIT','WITHDRAWAL','FEE'].includes(input.kind))throw new Error('meteora_cash_flow_producer_kind_invalid')
  assertIso(input.observedAt,'meteora_cash_flow_producer_observed_at_invalid')
  assertIso(input.availableAt,'meteora_cash_flow_producer_available_at_invalid')
  if(Date.parse(input.availableAt)<Date.parse(input.observedAt))throw new Error('meteora_cash_flow_producer_availability_invalid')
  const currencies=new Set<string>()
  const rows:MeteoraDlmmCashFlowEvidence[]=[]
  for(const asset of input.assets){
    if(!asset.currency.trim()||asset.amountMinor<0n)throw new Error('meteora_cash_flow_producer_asset_invalid')
    if(asset.amountMinor===0n)continue
    if(currencies.has(asset.currency))throw new Error('meteora_cash_flow_producer_duplicate_currency')
    currencies.add(asset.currency)
    const evidenceId=`meteora-cash-flow:${input.transactionId}:${input.position}:${input.kind.toLowerCase()}:${asset.currency}`
    rows.push(Object.freeze({
      evidenceId,
      rootFlowId:evidenceId,
      transactionId:input.transactionId,
      position:input.position,
      kind:input.kind,
      amountMinor:asset.amountMinor,
      currency:asset.currency,
      amountSemantics:'NATIVE_TRANSFER',
      valuationEvidenceIds:Object.freeze([]),
      observedAt:input.observedAt,
      availableAt:input.availableAt,
    }))
  }
  if(!rows.length)throw new Error('meteora_cash_flow_producer_nonzero_asset_required')
  return rows
}

export function applyVerifiedMeteoraCashFlowValuation(
  flow:MeteoraDlmmCashFlowEvidence,
  valuation:MeteoraCashFlowValuationEvidence,
):MeteoraDlmmCashFlowEvidence{
  if(flow.amountSemantics!=='NATIVE_TRANSFER')throw new Error('meteora_cash_flow_valuation_source_must_be_native')
  if(!valuation.valuationId.trim()||!valuation.targetCurrency.trim()||!valuation.evidenceIds.length)throw new Error('meteora_cash_flow_valuation_evidence_incomplete')
  if(valuation.sourceCurrency!==flow.currency||valuation.sourceAmountMinor!==flow.amountMinor)throw new Error('meteora_cash_flow_valuation_source_mismatch')
  if(valuation.valuedAmountMinor<0n)throw new Error('meteora_cash_flow_valuation_amount_invalid')
  assertIso(valuation.informationCutoff,'meteora_cash_flow_valuation_cutoff_invalid')
  assertIso(valuation.observedAt,'meteora_cash_flow_valuation_observed_at_invalid')
  assertIso(valuation.availableAt,'meteora_cash_flow_valuation_available_at_invalid')
  if(Date.parse(valuation.informationCutoff)>Date.parse(flow.observedAt))throw new Error('meteora_cash_flow_valuation_lookahead')
  if(Date.parse(valuation.observedAt)>Date.parse(flow.observedAt))throw new Error('meteora_cash_flow_valuation_price_after_flow')
  if(Date.parse(valuation.availableAt)<Date.parse(valuation.observedAt))throw new Error('meteora_cash_flow_valuation_availability_invalid')
  return Object.freeze({
    ...flow,
    evidenceId:`${flow.evidenceId}:valuation:${valuation.valuationId}`,
    rootFlowId:flow.rootFlowId??flow.evidenceId,
    amountMinor:valuation.valuedAmountMinor,
    currency:valuation.targetCurrency,
    amountSemantics:'VERIFIED_VALUATION',
    valuationEvidenceIds:Object.freeze([...new Set([valuation.valuationId,...valuation.evidenceIds])].sort()),
    availableAt:later(flow.availableAt,valuation.availableAt),
  })
}
