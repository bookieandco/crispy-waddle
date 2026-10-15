import type {Opportunity} from './opportunity.js'
import {
  buildSideHustleServiceWorkOrderDraft,
  type TemplatedCommercialWorkOrderDraft,
} from './side-hustle-service-template.js'

export type ClientCaptureOffer='AUDIT'|'SETUP'|'MANAGED_MONTHLY'
export type ClientCaptureDraft=Readonly<{
  offer:ClientCaptureOffer
  draft:TemplatedCommercialWorkOrderDraft
  paymentAuthorized:false
  externalActionAuthorized:false
  fulfillmentAuthorized:false
  authority:'QUOTE_ONLY'
}>

/** Productizes an existing Business Factory commercial template; does not create, bill or deliver an order. */
export function buildClientCaptureStudioDraft(input:Readonly<{
  opportunity:Opportunity
  workOrderId:string
  customerRef:string
  offer:ClientCaptureOffer
  evidenceRefs:readonly string[]
  createdAt:string
}>):ClientCaptureDraft {
  if(!input.workOrderId?.trim()||!input.customerRef?.trim()||!Number.isFinite(Date.parse(input.createdAt)))throw new Error('CLIENT_CAPTURE_ORDER_IDENTITY_REQUIRED')
  if(!input.evidenceRefs.length||new Set(input.evidenceRefs).size!==input.evidenceRefs.length||input.evidenceRefs.some(x=>!x.trim()))throw new Error('CLIENT_CAPTURE_SOURCE_EVIDENCE_REQUIRED')
  const profile=input.opportunity.metadata?.sideHustleProfile as {family?:string}|undefined
  if(profile?.family!=='business_automation')throw new Error('CLIENT_CAPTURE_BUSINESS_AUTOMATION_PROFILE_REQUIRED')
  const offers={
    AUDIT:{amount:99,cadence:'one_time' as const,title:'Client Capture audit'},
    SETUP:{amount:299,cadence:'project' as const,title:'Client Capture workflow setup'},
    MANAGED_MONTHLY:{amount:149,cadence:'monthly' as const,title:'Client Capture managed service'},
  }
  const config=offers[input.offer]
  if(!config)throw new Error('CLIENT_CAPTURE_OFFER_UNKNOWN')
  const base=buildSideHustleServiceWorkOrderDraft({
    opportunity:input.opportunity,id:input.workOrderId,customerRef:input.customerRef,
    title:config.title,price:{amount:config.amount,currency:'USD',cadence:config.cadence},
    evidenceRefs:[...input.evidenceRefs],createdAt:input.createdAt,
  })
  const scope=input.offer==='AUDIT'
    ?base.scopeItems.filter(s=>s.id==='audit')
    :input.offer==='MANAGED_MONTHLY'
      ?[{id:'monitor',title:'Managed intake monitoring',description:'Review the approved inquiry workflow and its error/exception evidence.',evidenceRefs:base.evidenceRefs},
        {id:'support',title:'Customer exception support',description:'Route exceptions according to the approved customer access boundary.',evidenceRefs:base.evidenceRefs},
        {id:'report',title:'Monthly outcome report',description:'Report actual handled leads, exceptions and measured conversion baseline.',evidenceRefs:base.evidenceRefs}]
      :base.scopeItems
  const acceptance=input.offer==='AUDIT'
    ?[{id:'audit-report',description:'Client receives evidence-backed intake and response audit.',required:true},
      {id:'baseline',description:'Current intake baseline, assumptions and unknowns are recorded.',required:true}]
    :input.offer==='MANAGED_MONTHLY'
      ?[{id:'monitor-receipt',description:'Monthly monitoring observations are linked.',required:true},
        {id:'exception-receipt',description:'Failed and manually escalated items are accounted for.',required:true},
        {id:'customer-acceptance',description:'Customer acknowledges the monthly service report.',required:true}]
      :base.acceptanceCriteria
  return Object.freeze({
    offer:input.offer,
    draft:Object.freeze({...base,scopeItems:scope,acceptanceCriteria:acceptance,
      evidenceRefs:[...base.evidenceRefs,'product:client-capture-studio:v1'],
      outcomePromise:input.offer==='AUDIT'?'Deliver an evidence-based inquiry-handling audit, not promised revenue or a deployed automation.':input.offer==='MANAGED_MONTHLY'?'Operate and report on an already-approved customer-intake workflow.':base.outcomePromise,
    }),
    authority:'QUOTE_ONLY' as const,paymentAuthorized:false as const,
    externalActionAuthorized:false as const,fulfillmentAuthorized:false as const,
  })
}
