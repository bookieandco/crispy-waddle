import type { ConstructionFulfillmentModel } from './construction-fulfillment.js'
import type { ProviderQuote } from './provider-quote.js'
export type ConstructionTenderModel={opportunityId:string;boqItemCount:number;quotedCost:number;currency:string;unpricedBoqItemIds:string[];quoteEvidenceRefs:string[];pricingCommitmentAuthorized:false;bidSubmissionAuthorized:false}
export function buildConstructionTenderModel(model:ConstructionFulfillmentModel,quotes:ProviderQuote[]):ConstructionTenderModel{
 const accepted=quotes.filter(q=>q.opportunityId===model.opportunityId&&q.status==='accepted_for_model'&&q.quotedAmount!==undefined&&q.quoteEvidenceRef)
 const covered=new Set(accepted.flatMap(q=>q.requirementIds));const currencies=[...new Set(accepted.map(q=>q.currency))]
 return {opportunityId:model.opportunityId,boqItemCount:model.boq.length,quotedCost:accepted.reduce((n,q)=>n+(q.quotedAmount??0),0),currency:currencies.length===1?currencies[0]:'MIXED',unpricedBoqItemIds:model.boq.filter(i=>!covered.has(i.requirementId)).map(i=>i.id),quoteEvidenceRefs:accepted.flatMap(q=>q.quoteEvidenceRef?[q.quoteEvidenceRef]:[]),pricingCommitmentAuthorized:false,bidSubmissionAuthorized:false}
}
