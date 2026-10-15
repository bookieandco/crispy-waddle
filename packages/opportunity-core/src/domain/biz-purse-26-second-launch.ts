import type {BusinessFactoryUnit} from './biz-purse-20-multi-factory.js'
import {assessTwoBusinessFactory} from './biz-purse-20-multi-factory.js'
/** BIZ-PURSE.26: independent second-business launch evidence review. */
export function reviewSecondBusinessLaunch(input:Readonly<{
 ownerUserId:string;businesses:readonly BusinessFactoryUnit[];
 aggregateBudgetCapMinor:bigint;stopRequested:boolean;
 licensedCatalogEvidenceIds:readonly string[];
 syntheticDeliveryProofId:string|null;
 refundDrillReceiptId:string|null;
 customerRightsReviewed:boolean
}>){
 const factory=assessTwoBusinessFactory({ownerUserId:input.ownerUserId,units:input.businesses,
  aggregateBudgetCapMinor:input.aggregateBudgetCapMinor,stopRequested:input.stopRequested})
 const reasons:string[]=[...factory.reasons]
 if(factory.status!=='TWO_REHEARSALS_REVIEW_READY')reasons.push('TWO_BUSINESS_REHEARSAL_INCOMPLETE')
 if(!input.licensedCatalogEvidenceIds.length||new Set(input.licensedCatalogEvidenceIds).size!==input.licensedCatalogEvidenceIds.length||
  input.licensedCatalogEvidenceIds.some(x=>!x))reasons.push('DIGITAL_PRODUCT_RIGHTS_EVIDENCE_MISSING')
 if(!input.customerRightsReviewed)reasons.push('CUSTOMER_DELIVERY_RIGHTS_NOT_REVIEWED')
 if(!input.syntheticDeliveryProofId||!input.refundDrillReceiptId||
  input.syntheticDeliveryProofId===input.refundDrillReceiptId)
  reasons.push('SECOND_BUSINESS_DELIVERY_REFUND_DRILL_MISSING')
 return Object.freeze({status:reasons.length?'BLOCKED' as const:'SECOND_BUSINESS_PILOT_REVIEW_ONLY' as const,
  reasons:Object.freeze([...new Set(reasons)]),ownerUserId:input.ownerUserId,
  authority:'SECOND_BUSINESS_NONCOMMERCIAL_REHEARSAL' as const,
  canPublish:false as const,canDeliverRealOrders:false as const,canCharge:false as const,
  canRecognizeProfit:false as const,canTransfer:false as const})
}
