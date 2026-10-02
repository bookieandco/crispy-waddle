import {
  fuseRelationshipContext,
  type EntityContextLink,
} from '@jhadina/relationship-core'
import {ProductionRelationshipRepository} from './production-repository'

export async function persistRelationshipContextEvent(
  repo:ProductionRelationshipRepository,
  input:{
    entityId:string
    kind:EntityContextLink['contextKind']
    contextRef:string
    relation:string
    activityType:string
    summary:string
    occurredAt:string
    evidenceRefs:readonly string[]
    metadata?:Readonly<Record<string,unknown>>
  },
){
  const fused=fuseRelationshipContext(input)
  await repo.appendActivity(fused.activity)
  await repo.upsertContextLink(fused.link)
  return fused
}

export const relationshipContextAdapters=Object.freeze({
  email:(input:{entityId:string;messageRef:string;occurredAt:string;evidenceRefs:readonly string[];direction:'sent'|'received'})=>({
    entityId:input.entityId,kind:'email' as const,contextRef:input.messageRef,
    relation:input.direction==='sent'?'sent_to':'received_from',
    activityType:'email.'+input.direction,summary:'Email '+input.direction+'.',
    occurredAt:input.occurredAt,evidenceRefs:input.evidenceRefs,
  }),
  message:(input:{entityId:string;messageRef:string;occurredAt:string;evidenceRefs:readonly string[];direction:'sent'|'received'})=>({
    entityId:input.entityId,kind:'message' as const,contextRef:input.messageRef,
    relation:input.direction==='sent'?'sent_to':'received_from',
    activityType:'message.'+input.direction,summary:'Message '+input.direction+'.',
    occurredAt:input.occurredAt,evidenceRefs:input.evidenceRefs,
  }),
  task:(input:{entityId:string;taskRef:string;occurredAt:string;evidenceRefs:readonly string[];status:string})=>({
    entityId:input.entityId,kind:'task' as const,contextRef:input.taskRef,
    relation:'task_for',activityType:'task.'+input.status,summary:'Relationship task '+input.status+'.',
    occurredAt:input.occurredAt,evidenceRefs:input.evidenceRefs,
  }),
  file:(input:{entityId:string;fileRef:string;occurredAt:string;evidenceRefs:readonly string[];label?:string})=>({
    entityId:input.entityId,kind:'file' as const,contextRef:input.fileRef,
    relation:'file_for',activityType:'file.linked',summary:input.label?'File linked: '+input.label:'File linked.',
    occurredAt:input.occurredAt,evidenceRefs:input.evidenceRefs,
  }),
  document:(input:{entityId:string;documentRef:string;occurredAt:string;evidenceRefs:readonly string[];label?:string})=>({
    entityId:input.entityId,kind:'document' as const,contextRef:input.documentRef,
    relation:'document_for',activityType:'document.linked',summary:input.label?'Document linked: '+input.label:'Document linked.',
    occurredAt:input.occurredAt,evidenceRefs:input.evidenceRefs,
  }),
  contract:(input:{entityId:string;contractRef:string;occurredAt:string;evidenceRefs:readonly string[];status:string})=>({
    entityId:input.entityId,kind:'contract' as const,contextRef:input.contractRef,
    relation:'contract_with',activityType:'contract.'+input.status,summary:'Contract state: '+input.status+'.',
    occurredAt:input.occurredAt,evidenceRefs:input.evidenceRefs,
  }),
  order:(input:{entityId:string;orderRef:string;occurredAt:string;evidenceRefs:readonly string[];status:string})=>({
    entityId:input.entityId,kind:'order' as const,contextRef:input.orderRef,
    relation:'order_for',activityType:'order.'+input.status,summary:'Order state: '+input.status+'.',
    occurredAt:input.occurredAt,evidenceRefs:input.evidenceRefs,
  }),
})
