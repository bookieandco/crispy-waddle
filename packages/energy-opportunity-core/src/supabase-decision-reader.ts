import type { MiningDecisionRecord } from './economic-decision.ts';
import { buildMiningCommandCenterCard, type MiningCommandCenterCard } from './command-center.ts';

export interface SupabaseDecisionReaderConfig {
  projectUrl: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
}

export interface MiningDecisionReader {
  getLatestDecision(resourceId: string): Promise<MiningCommandCenterCard | null>;
  getDecisionHistory(resourceId: string, limit?: number): Promise<MiningCommandCenterCard[]>;
}

/** Read-only Command Center adapter. It cannot write financial records or control hardware. */
export class SupabaseMiningDecisionReader implements MiningDecisionReader {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly anonKey: string;

  constructor(config: SupabaseDecisionReaderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.endpoint = `${config.projectUrl.replace(/\/$/, '')}/rest/v1/jhadina_mining_decisions`;
    this.anonKey = config.anonKey;
  }

  async getLatestDecision(resourceId: string): Promise<MiningCommandCenterCard | null> {
    const records = await this.fetchRecords(resourceId, 1);
    return records.length === 0 ? null : buildMiningCommandCenterCard(records[0]);
  }

  async getDecisionHistory(resourceId: string, limit = 25): Promise<MiningCommandCenterCard[]> {
    return (await this.fetchRecords(resourceId, limit)).map(buildMiningCommandCenterCard);
  }

  private async fetchRecords(resourceId: string, limit: number): Promise<MiningDecisionRecord[]> {
    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const params = new URLSearchParams({
      resource_id: `eq.${resourceId}`,
      order: 'observed_at.desc',
      limit: String(boundedLimit),
    });
    const response = await this.fetchImpl(`${this.endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.anonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase mining decision read failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as MiningDecisionRecord[];
  }
}
