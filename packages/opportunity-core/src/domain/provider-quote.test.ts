import assert from 'node:assert/strict'
import { acceptProviderQuoteForModel, createProviderQuoteRequest, recordProviderQuote } from './provider-quote.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import type { ProviderOutreachPacket } from './provider-outreach.js'
const plan:FulfillmentPlan={opportunityId:'o',structure:'prime_with_subcontractor',assignments:[{providerId:'p',role:'subcontractor',requirementIds:['r'],evidenceRefs:['e'],score:90}],coveredRequirementIds:['r'],uncoveredRequirementIds:[],blockers:[],rationale:[],requiresHumanApproval:true,engagementAuthorized:false}
const packet:ProviderOutreachPacket={id:'pkt',opportunityId:'o',providerId:'p',role:'subcontractor',requirementIds:['r'],evidenceRefs:['e'],subject:'Quote',draftBody:'Quote?',diligenceQuestions:[],negotiationPoints:[],commercialSummary:{structure:'prime_with_subcontractor',modeledGrossRevenue:100,modeledMarginPercent:20},approvalRef:'a',draftOnly:true,sendAuthorized:false,contractAuthorized:false}
const q=createProviderQuoteRequest(plan,packet);assert.equal(q.paymentAuthorized,false)
const r=recordProviderQuote(q,{quotedAmount:60,evidenceRef:'quote:1',validUntil:'2026-10-01T00:00:00Z',recordedAt:'2026-09-20T00:00:00Z'})
const accepted=acceptProviderQuoteForModel(r,'2026-09-21T00:00:00Z');assert.equal(accepted.status,'accepted_for_model');assert.equal(accepted.pricingModelAuthorized,false)
