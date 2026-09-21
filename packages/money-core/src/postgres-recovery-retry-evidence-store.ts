import type { SqlClient } from './postgres-idempotency-store.js'
import type { RecoveryObservation } from './execution-recovery.js'
import type { RecoveryRetryEvidenceStore } from './recovery-retry-evidence.js'

type Row={
 execution_id:string;proposal_hash:string;provider_operation:string;provider_reference:string|null;
 observed_state:RecoveryObservation['observedState'];evidence:Record<string,unknown>;evidence_hash:string;
 adapter_id:string;adapter_version:number;checked_at:string|Date
}
function tableIdentifier(value:string){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))throw new Error('MONEY_RECOVERY_TABLE_INVALID');return value}
function iso(value:string|Date){return value instanceof Date?value.toISOString():new Date(value).toISOString()}

export class PostgresRecoveryRetryEvidenceStore implements RecoveryRetryEvidenceStore{
 private readonly client:SqlClient;private readonly table:string
 constructor(input:{client:SqlClient;tableName?:string}){this.client=input.client;this.table=tableIdentifier(input.tableName??'jhadina_connector_execution_reconciliation')}
 async getLatestObservation(executionId:string):Promise<RecoveryObservation|undefined>{
  const result=await this.client.query<Row>(`SELECT execution_id,proposal_hash,provider_operation,provider_reference,observed_state,evidence,evidence_hash,adapter_id,adapter_version,checked_at FROM ${this.table} WHERE execution_id=$1 ORDER BY checked_at DESC,reconciliation_id DESC LIMIT 1`,[executionId])
  const row=result.rows[0];if(!row)return undefined
  return {executionId:row.execution_id,proposalHash:row.proposal_hash,providerOperation:row.provider_operation,providerReference:row.provider_reference??undefined,observedState:row.observed_state,evidence:row.evidence,evidenceHash:row.evidence_hash,adapterId:row.adapter_id,adapterVersion:row.adapter_version,checkedAt:iso(row.checked_at)}
 }
}
