import type { OpportunityRequirementSet } from './opportunity-requirement.js'
export type ConstructionResourceKind='labor'|'material'|'equipment'|'subcontract'
export type ConstructionBoqItem={id:string;requirementId:string;trade:string;description:string;quantity?:number;unit?:string;resourceKinds:ConstructionResourceKind[];sourceEvidenceRefs:string[];confidence:number;blockers:string[]}
export type ConstructionFulfillmentModel={opportunityId:string;boq:ConstructionBoqItem[];trades:string[];scheduleRequirementIds:string[];unresolved:string[];humanReviewRequired:true}
const tradeRules=[['electrical',/electrical|wiring|power|lighting/i],['plumbing',/plumb|pipe|water|sewer/i],['hvac',/hvac|heating|ventilation|air conditioning/i],['concrete',/concrete|cement|foundation/i],['general',/construct|renovation|repair|building/i]] as const
export function buildConstructionFulfillmentModel(set:OpportunityRequirementSet):ConstructionFulfillmentModel{
 const boq:ConstructionBoqItem[]=[];const unresolved=[...set.unresolved]
 for(const r of set.requirements.filter(r=>r.kind==='capability'||r.kind==='schedule')){
  if(r.kind==='schedule')continue
  const trade=tradeRules.find(([,rx])=>rx.test(r.label+' '+r.keywords.join(' ')))?.[0]??'specialty'
  boq.push({id:`${r.id}:boq`,requirementId:r.id,trade,description:r.label,resourceKinds:['labor','material','equipment','subcontract'],sourceEvidenceRefs:r.sourceEvidenceIds,confidence:r.confidence,blockers:r.evidenceStatus==='inferred'?['Quantity/scope requires solicitation-document confirmation.']:[]})
 }
 if(!boq.length)unresolved.push('No construction BOQ items could be derived from requirements.')
 return {opportunityId:set.opportunityId,boq,trades:[...new Set(boq.map(x=>x.trade))],scheduleRequirementIds:set.requirements.filter(r=>r.kind==='schedule').map(r=>r.id),unresolved:[...new Set(unresolved)],humanReviewRequired:true}
}
