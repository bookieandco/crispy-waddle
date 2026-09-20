import type { ActionLedger } from '@jhadina/action-core';
import type { DurableInferenceRecord, InferenceLedgerSink } from '@jhadina/intelligence-core';

/** Reuses Jhadina's hash-chained durable audit primitive; no parallel DB ledger. */
export class ActionAuditInferenceLedgerSink implements InferenceLedgerSink {
 constructor(private readonly ledger:ActionLedger,private readonly actorId:string){}
 async append(record:DurableInferenceRecord):Promise<void>{
  await this.ledger.append({
   id:`inference:${record.inferenceId}`,actionId:record.inferenceId,userId:this.actorId,
   type:'intelligence.inference',status:record.outcome==='succeeded'?'completed':'failed',
   timestamp:record.observedAt,
   metadata:{
    taskId:record.taskId,contextHash:record.contextHash,provider:record.provider,
    routeReason:record.routeReason,evidenceIds:[...record.evidenceIds],proposalId:record.proposalId,
    errorCode:record.errorCode,telemetry:record.telemetry,
   },
  });
 }
}
