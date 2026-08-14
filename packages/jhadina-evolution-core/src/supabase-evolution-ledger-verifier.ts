export interface PersistedLedgerVerifier {
  verify(runId: number): Promise<boolean>;
}

export interface SupabaseLedgerVerifierOptions {
  url: string;
  key: string;
  fetchImpl?: typeof fetch;
}

export class SupabaseEvolutionLedgerVerifier implements PersistedLedgerVerifier {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseLedgerVerifierOptions) {
    this.baseUrl = options.url.replace(/\/$/, "");
    this.key = options.key;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async verify(runId: number): Promise<boolean> {
    const headers: Record<string, string> = {
      apikey: this.key,
      "Content-Type": "application/json",
    };

    // New Supabase secret/publishable keys are opaque API keys, not JWTs.
    if (!this.key.startsWith("sb_")) headers.Authorization = `Bearer ${this.key}`;

    const response = await this.fetchImpl(`${this.baseUrl}/rest/v1/rpc/verify_jhadina_evolution_run_ledger`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_run_id: runId }),
    });

    if (!response.ok) {
      throw new Error(`Supabase evolution ledger verification failed (${response.status})`);
    }

    return (await response.json()) as boolean;
  }
}
