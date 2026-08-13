import type { EvolutionRunLedger, EvolutionRunLedgerEvent } from "./evolution-run-ledger";

export interface SupabaseEvolutionRunLedgerOptions {
  url: string;
  key: string;
  fetchImpl?: typeof fetch;
}

/** Append-only persistence adapter. Sequence/hash authority lives in Postgres. */
export class SupabaseEvolutionRunLedger implements EvolutionRunLedger {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseEvolutionRunLedgerOptions) {
    this.baseUrl = options.url.replace(/\/$/, "");
    this.key = options.key;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async append(input: Omit<EvolutionRunLedgerEvent, "sequence" | "eventId" | "previousHash" | "hash">): Promise<EvolutionRunLedgerEvent> {
    const rows = await this.request<EvolutionRunLedgerEvent[]>(
      "POST",
      "/rest/v1/rpc/append_jhadina_evolution_run_ledger",
      {
        p_run_id: input.runId,
        p_task_id: input.taskId,
        p_type: input.type,
        p_occurred_at: input.occurredAt,
        p_payload: input.payload,
      },
    );
    if (rows.length !== 1) throw new Error("Evolution run ledger RPC did not return its appended event");
    return rows[0];
  }

  async list(runId: number): Promise<EvolutionRunLedgerEvent[]> {
    return this.request<EvolutionRunLedgerEvent[]>(
      "GET",
      `/rest/v1/jhadina_evolution_run_ledger?run_id=eq.${encodeURIComponent(String(runId))}&order=sequence.asc`,
    );
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase evolution ledger request failed (${response.status}): ${text}`);
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}
