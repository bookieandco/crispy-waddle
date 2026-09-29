import type { SqlClient } from './postgres-idempotency-store.js'
import type { MemeGovernedLiveReport,MemeProviderSoakEvidence } from './meme-live-governed.js'

export class PostgresMemeGovernedLiveEvidenceStore{
 constructor(private readonly client:SqlClient){}
 async putSoak(e:MemeProviderSoakEvidence):Promise<void>{
  await this.client.query(
   `INSERT INTO money_meme_provider_soak_evidence(
     soak_id,evidence_class,provider,wallet_connection_id,started_at,ended_at,completed_round_trips,reconciled_broadcasts,
     unresolved_executions,duplicate_broadcasts,unknown_executions,kill_switch_drill_passed,restart_recovery_passed,
     all_positions_flat,execution_cost_reconciliation_passed,max_observed_slippage_bps,venue_coverage,provider_receipt_ids,
     onchain_signature_ids,evidence_ids
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    ON CONFLICT(soak_id) DO UPDATE SET
     ended_at=EXCLUDED.ended_at,
     completed_round_trips=EXCLUDED.completed_round_trips,
     reconciled_broadcasts=EXCLUDED.reconciled_broadcasts,
     unresolved_executions=EXCLUDED.unresolved_executions,
     duplicate_broadcasts=EXCLUDED.duplicate_broadcasts,
     unknown_executions=EXCLUDED.unknown_executions,
     kill_switch_drill_passed=EXCLUDED.kill_switch_drill_passed,
     restart_recovery_passed=EXCLUDED.restart_recovery_passed,
     all_positions_flat=EXCLUDED.all_positions_flat,
     execution_cost_reconciliation_passed=EXCLUDED.execution_cost_reconciliation_passed,
     max_observed_slippage_bps=EXCLUDED.max_observed_slippage_bps,
     venue_coverage=EXCLUDED.venue_coverage,
     provider_receipt_ids=EXCLUDED.provider_receipt_ids,
     onchain_signature_ids=EXCLUDED.onchain_signature_ids,
     evidence_ids=EXCLUDED.evidence_ids`,
   [
    e.soakId,e.evidenceClass,e.provider,e.walletConnectionId,e.startedAt,e.endedAt,e.completedRoundTrips,e.reconciledBroadcasts,
    e.unresolvedExecutions,e.duplicateBroadcasts,e.unknownExecutions,e.killSwitchDrillPassed,e.restartRecoveryPassed,
    e.allPositionsFlatAfterRoundTrips,e.executionCostReconciliationPassed,e.maxObservedSlippageBps,[...e.venueCoverage],
    [...e.providerReceiptIds],[...e.onchainSignatureIds],[...e.evidenceIds],
   ],
  )
 }
 async putCertification(input:{report:MemeGovernedLiveReport;strategyId:string;recordedAt:string}):Promise<void>{
  const {report:r}=input
  if(!input.strategyId.trim()||Number.isNaN(Date.parse(input.recordedAt)))throw new Error('MEME_GOVERNED_PERSIST_INPUT_INVALID')
  await this.client.query(
   `INSERT INTO money_meme_governed_live_certifications(
     report_id,version,mandate_id,wallet_connection_id,strategy_id,status,passed,controlled_canary_certified,router_commissioned,
     coffer_commissioned,provider_soak_passed,owner_mandate_valid,blocker_codes,evidence_ids,unrestricted_live_authorized,recorded_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,FALSE,$15)
    ON CONFLICT(report_id) DO NOTHING`,
   [
    r.reportId,r.version,r.mandateId??null,r.walletConnectionId??null,input.strategyId,r.status,r.passed,r.controlledCanaryCertified,
    r.routerCommissioned,r.cofferCommissioned,r.providerSoakPassed,r.ownerMandateValid,[...r.blockerCodes],[...r.evidenceIds],input.recordedAt,
   ],
  )
 }
}
