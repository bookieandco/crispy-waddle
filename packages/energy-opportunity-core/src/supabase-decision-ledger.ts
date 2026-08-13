import type { MiningDecisionRecord } from './economic-decision.ts';
import type { MiningDecisionLedger } from './decision-ledger.ts';

export interface SupabaseDecisionLedgerConfig {
  /** Supabase project URL, e.g. https://<project>.supabase.co */
  projectUrl: string;
  /** Server-side credential. Never expose this to browser/client code. */
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
}

/**
 * Server-side persistence adapter for advisory mining decisions.
 * The service-role credential must only be supplied by a trusted backend.
 */
export class SupabaseMiningDecisionLedger implements MiningDecisionLedger {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly config: SupabaseDecisionLedgerConfig;

  constructor(config: SupabaseDecisionLedgerConfig) {
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.endpoint = `${config.projectUrl.replace(/\/$/, '')}/rest/v1/jhadina_mining_decisions`;
  }

  async append(record: MiningDecisionRecord): Promise<void> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        apikey: this.config.serviceRoleKey,
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({
        decision_id: record.decisionId,
        resource_id: record.resourceId,
        decision: record.decision,
        observed_at: record.observedAt,
        projected_gross_per_hour: record.projectedGrossPerHour,
        projected_electricity_per_hour: record.projectedElectricityPerHour,
        projected_net_per_hour: record.projectedNetPerHour,
        health: record.health,
        confidence: record.confidence,
        reasons: record.reasons,
        policy_version: record.policyVersion,
      }),
    });

    if (!response.ok) {
      throw new Error(`Supabase mining decision insert failed: ${response.status} ${response.statusText}`);
    }
  }
}
