import type { CompetitiveEvidence, CompetitorObservation } from "@jhadina/opportunity-contracts";
import type { CompetitiveEvidenceRecorder, RawCompetitiveObservation } from "./index";

export interface AsyncCompetitiveEvidenceRepository {
  recordObservation(input: RawCompetitiveObservation): Promise<CompetitiveEvidence<CompetitorObservation>>;
  get(ownerId: string, evidenceId: string): Promise<CompetitiveEvidence<CompetitorObservation> | undefined>;
}

type CompetitiveEvidenceRow = {
  evidence_id: string;
  owner_id: string;
  kind: "observed_fact";
  subject_id: string;
  value: CompetitorObservation;
  source: CompetitiveEvidence<CompetitorObservation>["source"];
  confidence: number | null;
  derived_from_evidence_ids: string[] | null;
  model_id: string | null;
  created_at: string;
  observed_at: string;
};

interface SingleResultBuilder {
  maybeSingle(): Promise<{ data: CompetitiveEvidenceRow | null; error: { code?: string; message: string } | null }>;
}

interface SelectBuilder extends SingleResultBuilder {
  eq(column: string, value: string): SelectBuilder;
}

interface InsertBuilder extends SingleResultBuilder {
  select(columns?: string): SingleResultBuilder;
}

interface CompetitiveEvidenceTable {
  insert(values: CompetitiveEvidenceRow): InsertBuilder;
  select(columns?: string): SelectBuilder;
}

/** Minimal structural surface of Supabase used by this adapter. */
export interface CompetitiveEvidenceSupabaseClient {
  from(table: "competitive_evidence"): CompetitiveEvidenceTable;
}

const DUPLICATE_KEY = "23505";

export class SupabaseCompetitiveEvidenceRepository implements AsyncCompetitiveEvidenceRepository {
  constructor(
    private readonly supabase: CompetitiveEvidenceSupabaseClient,
    private readonly recorder: CompetitiveEvidenceRecorder,
  ) {}

  async recordObservation(input: RawCompetitiveObservation): Promise<CompetitiveEvidence<CompetitorObservation>> {
    const evidence = this.recorder.recordObservation(input);
    const row: CompetitiveEvidenceRow = {
      evidence_id: evidence.evidenceId,
      owner_id: evidence.ownerId,
      kind: "observed_fact",
      subject_id: evidence.subjectId,
      value: evidence.value,
      source: evidence.source!,
      confidence: evidence.confidence ?? null,
      derived_from_evidence_ids: evidence.derivedFromEvidenceIds ?? null,
      model_id: evidence.modelId ?? null,
      created_at: evidence.createdAt,
      observed_at: evidence.value.observedAt,
    };

    const { data, error } = await this.supabase
      .from("competitive_evidence")
      .insert(row)
      .select("*")
      .maybeSingle();

    if (!error && data) return toEvidence(data);

    if (error?.code === DUPLICATE_KEY) {
      const existing = await this.get(input.ownerId, evidence.evidenceId);
      if (existing) return existing;
    }

    throw new Error(error?.message ?? "Competitive evidence insert returned no row");
  }

  async get(ownerId: string, evidenceId: string): Promise<CompetitiveEvidence<CompetitorObservation> | undefined> {
    if (ownerId.trim() === "" || evidenceId.trim() === "") return undefined;

    const { data, error } = await this.supabase
      .from("competitive_evidence")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("evidence_id", evidenceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? toEvidence(data) : undefined;
  }
}

function toEvidence(row: CompetitiveEvidenceRow): CompetitiveEvidence<CompetitorObservation> {
  if (row.kind !== "observed_fact") {
    throw new Error("Competitive evidence repository only accepts observed_fact rows");
  }

  return Object.freeze({
    evidenceId: row.evidence_id,
    ownerId: row.owner_id,
    kind: row.kind,
    subjectId: row.subject_id,
    value: Object.freeze({ ...row.value }),
    source: Object.freeze({ ...row.source }),
    ...(row.confidence === null ? {} : { confidence: row.confidence }),
    ...(row.derived_from_evidence_ids === null
      ? {}
      : { derivedFromEvidenceIds: Object.freeze([...row.derived_from_evidence_ids]) }),
    ...(row.model_id === null ? {} : { modelId: row.model_id }),
    createdAt: row.created_at,
  });
}
