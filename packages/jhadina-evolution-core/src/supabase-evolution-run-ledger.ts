import type { EvolutionRunLedger, EvolutionRunLedgerEvent } from "./evolution-run-ledger";

export interface SupabaseEvolutionRunLedgerOptions {
  url: string;
  key: string;
  fetchImpl?: typeof fetch;
}

/** Append-only persistence adapter for the evolution run ledger. */
export class SupabaseEvolutionRunLedger implements EvolutionRunLedger {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseEvolutionRunLedgerOptions) {
    this.baseUrl = options.url.replace(/\/$/, "");
    this.key = options.key;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async append(input: Omit<EvolutionRunLedgerEvent, "sequence" | "eventId" | "hash">): Promise<EvolutionRunLedgerEvent> {
    const previous = await this.list(input.runId);
    const previousHash = previous.at(-1)?.hash ?? null;
    const sequence = previous.length + 1;
    const eventId = `${input.runId}:${sequence}`;
    const hash = await sha256(JSON.stringify({ ...input, sequence, eventId, previousHash }));

    const event: EvolutionRunLedgerEvent = { ...input, sequence, eventId, previousHash, hash };
    const rows = await this.request<EvolutionRunLedgerEvent[]>(
      "POST",
      "/rest/v1/jhadina_evolution_run_ledger",
      event,
      { Prefer: "return=representation" },
    );
    if (rows.length !== 1) throw new Error("Evolution run ledger did not return its appended event");
    return rows[0];
  }

  async list(runId: number): Promise<EvolutionRunLedgerEvent[]> {
    return this.request<EvolutionRunLedgerEvent[]>(
      "GET",
      `/rest/v1/jhadina_evolution_run_ledger?run_id=eq.${encodeURIComponent(String(runId))}&order=sequence.asc`,
    );
  }

  private async request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase evolution ledger request failed (${response.status}): ${text}`);
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
