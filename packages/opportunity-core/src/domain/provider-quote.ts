import type { FulfillmentPlan } from './fulfillment-plan.js'
import type { ProviderOutreachPacket } from './provider-outreach.js'

export type ProviderQuoteStatus='draft'|'response_recorded'|'accepted_for_model'|'rejected'
export type ProviderQuote={
 id:string;opportunityId:string;providerId:string;requirementIds:string[];currency:string
 status:ProviderQuoteStatus;requestPacketId:string;requestedAmount?:number;quotedAmount?:number
 quoteEvidenceRef?:string;validUntil?:string;recordedAt?:string
 pricingModelAuthorized:false;paymentAuthorized:false
}

export function createProviderQuoteRequest(plan:FulfillmentPlan,packet:ProviderOutreachPacket):ProviderQuote{
 const assignment=plan.assignments.find(a=>a.providerId===packet.providerId)
 if(!assignment||packet.opportunityId!==plan.opportunityId)throw new Error('Quote request must bind to a fulfillment assignment')
 if(!assignment.requirementIds.every(id=>packet.requirementIds.includes(id)))throw new Error('Quote packet must cover the assigned requirements')
 return {id:`${packet.id}:quote`,opportunityId:plan.opportunityId,providerId:packet.providerId,requirementIds:[...assignment.requirementIds],currency:'USD',status:'draft',requestPacketId:packet.id,pricingModelAuthorized:false,paymentAuthorized:false}
}

export function recordProviderQuote(quote:ProviderQuote,input:{quotedAmount:number;currency?:string;evidenceRef:string;validUntil?:string;recordedAt?:string}):ProviderQuote{
 if(quote.status!=='draft')throw new Error('Quote response may only be recorded once')
 if(!Number.isFinite(input.quotedAmount)||input.quotedAmount<0)throw new Error('Quoted amount must be a non-negative finite number')
 if(!input.evidenceRef.trim())throw new Error('Quote evidence is required')
 return {...quote,status:'response_recorded',quotedAmount:input.quotedAmount,currency:input.currency?.trim()||quote.currency,quoteEvidenceRef:input.evidenceRef.trim(),validUntil:input.validUntil,recordedAt:input.recordedAt??new Date().toISOString(),pricingModelAuthorized:false,paymentAuthorized:false}
}

export function acceptProviderQuoteForModel(quote:ProviderQuote,now=new Date().toISOString()):ProviderQuote{
 if(quote.status!=='response_recorded'||quote.quotedAmount===undefined||!quote.quoteEvidenceRef)throw new Error('Recorded evidence-backed quote required')
 if(quote.validUntil&&Date.parse(quote.validUntil)<=Date.parse(now))throw new Error('Provider quote is expired')
 return {...quote,status:'accepted_for_model',pricingModelAuthorized:false,paymentAuthorized:false}
}
