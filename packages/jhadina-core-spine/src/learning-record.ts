import type { DecisionProposal } from './types.js'

export type LearningEvidence = Readonly<{ id:string; source:string; observedAt:string; summary:string }>
export type LearningRecordInput = Readonly<{
  id:string; occurredAt:string; domain:string; experience:Readonly<{id:string}>
  decision:Readonly<{proposalId:string;policyDecisionId:string;actionRequestId:string;actionResultId:string}>
  evidence:readonly LearningEvidence[]; prediction:Readonly<{hypothesis:string;expectedOutcome:string;confidence:number}>
  outcome:Readonly<{status:string;actualOutcome:string;observedAt:string;evidence:readonly LearningEvidence[]}>
  learningUpdate:Readonly<{kind:string;target:string;reason:string;updateVersion:string}>
  provenance:Readonly<{source:string;actor:string;correlationId?:string}>
}>
export type LearningRecord = Readonly<LearningRecordInput & {schemaVersion:'1.0';experienceId:string}>

export function createLearningRecord(input:LearningRecordInput):LearningRecord {
  const observed=input.outcome.status!=='unknown'&&input.outcome.status!=='not-observed'
  if(observed&&(!input.evidence.length||!input.outcome.evidence.length)) throw new Error('learning_record_evidence_required')
  const outcome=Object.freeze({...input.outcome,evidence:Object.freeze([...input.outcome.evidence])})
  return Object.freeze({...input,schemaVersion:'1.0' as const,experienceId:input.experience.id,evidence:Object.freeze([...input.evidence]),outcome})
}
export function createLearningRecordFromSpine(input:{
 id:string;occurredAt:string;domain:string;experience:{id:string};decision:DecisionProposal;
 policy:{id:string;proposalId:string};action:{id:string;proposalId:string};result:{id:string;requestId:string};
 outcome:LearningRecordInput['outcome'];prediction:LearningRecordInput['prediction'];learningUpdate:LearningRecordInput['learningUpdate'];provenance:LearningRecordInput['provenance']
}):LearningRecord {
 const evidence=[...input.decision.evidence,...input.outcome.evidence]
 return createLearningRecord({id:input.id,occurredAt:input.occurredAt,domain:input.domain,experience:input.experience,
 decision:{proposalId:input.decision.id,policyDecisionId:input.policy.id,actionRequestId:input.action.id,actionResultId:input.result.id},
 evidence,prediction:input.prediction,outcome:input.outcome,learningUpdate:input.learningUpdate,provenance:input.provenance})
}
export class InMemoryLearningRecordRepository {
 private readonly records=new Map<string,LearningRecord>()
 async append(record:LearningRecord){if(this.records.has(record.id))throw new Error('learning_record_duplicate_id');this.records.set(record.id,record)}
 async get(id:string){return this.records.get(id)??null}
 async listByCorrelation(id:string){return [...this.records.values()].filter(r=>r.provenance.correlationId===id)}
 async listByDomain(domain:string){return [...this.records.values()].filter(r=>r.domain===domain)}
}
