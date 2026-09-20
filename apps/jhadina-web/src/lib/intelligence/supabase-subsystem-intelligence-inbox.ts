import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SubsystemId,
  SubsystemIntelligenceRequest,
} from "@jhadina/intelligence-core";

export type SubsystemInboxPayload = Readonly<Record<string, unknown>>;

export type SubsystemInboxReceipt = {
  inboxId: string;
  receiptId: string;
  acceptedEvidenceIds: readonly string[];
};

type InboxRow = {
  id: string;
  actor_id: string;
  subsystem: SubsystemId;
  asset_id: string;
  asset_ref: string | null;
  media_type: string | null;
  privacy_class: string | null;
  content_sha256: string | null;
  evidence: Array<{
    id: string;
    source: string;
    observedAt: string;
    summary: string;
    immutable?: boolean;
  }>;
  uncertainty: string[];
  intent: string | null;
  payload: Record<string, unknown>;
};

const stable = (value: unknown): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("SUBSYSTEM_INBOX_NON_FINITE_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
  }
  throw new Error("SUBSYSTEM_INBOX_NON_JSON_VALUE");
};

function rowFor(
  subsystem: SubsystemId,
  input: SubsystemIntelligenceRequest,
  payload: SubsystemInboxPayload,
): InboxRow {
  if (!input.actorId.trim()) throw new Error("SUBSYSTEM_INBOX_ACTOR_REQUIRED");
  if (!input.assetId.trim()) throw new Error("SUBSYSTEM_INBOX_ASSET_REQUIRED");
  if (!input.evidence.length) throw new Error("SUBSYSTEM_INBOX_EVIDENCE_REQUIRED");
  if (input.evidence.some((evidence) => !evidence.id.startsWith(`asset:${input.assetId}:`))) {
    throw new Error("SUBSYSTEM_INBOX_EVIDENCE_NOT_ASSET_BOUND");
  }

  return {
    id: `subsystem-intake:${subsystem}:${input.assetId}`,
    actor_id: input.actorId,
    subsystem,
    asset_id: input.assetId,
    asset_ref: input.assetRef ?? null,
    media_type: input.mediaType ?? null,
    privacy_class: input.privacyClass ?? null,
    content_sha256: input.contentSha256 ?? null,
    evidence: input.evidence.map((evidence) => ({
      id: evidence.id,
      source: evidence.source,
      observedAt: evidence.observedAt,
      summary: evidence.summary,
      immutable: evidence.immutable,
    })),
    uncertainty: [...input.uncertainty],
    intent: input.intent ?? null,
    payload: { ...payload },
  };
}

/**
 * Durable, append-only transport into subsystem workers. This store records
 * bounded intelligence handoff only and intentionally exposes no action API.
 */
export class SupabaseSubsystemIntelligenceInbox {
  constructor(private readonly client: SupabaseClient) {}

  async enqueue(
    subsystem: SubsystemId,
    input: SubsystemIntelligenceRequest,
    payload: SubsystemInboxPayload = {},
  ): Promise<SubsystemInboxReceipt> {
    const row = rowFor(subsystem, input, payload);
    const { error } = await this.client.from("jhadina_subsystem_intelligence_inbox").insert(row);

    if (error) {
      if (error.code !== "23505") {
        throw new Error(`SUBSYSTEM_INBOX_APPEND_FAILED:${error.message}`);
      }
      const { data, error: readError } = await this.client
        .from("jhadina_subsystem_intelligence_inbox")
        .select("id,actor_id,subsystem,asset_id,asset_ref,media_type,privacy_class,content_sha256,evidence,uncertainty,intent,payload")
        .eq("id", row.id)
        .eq("actor_id", row.actor_id)
        .maybeSingle();
      if (readError) throw new Error(`SUBSYSTEM_INBOX_READ_FAILED:${readError.message}`);
      if (!data || stable(data as InboxRow) !== stable(row)) {
        throw new Error("SUBSYSTEM_INBOX_ID_CONFLICT");
      }
    }

    return Object.freeze({
      inboxId: row.id,
      receiptId: `intake-receipt:${row.id}`,
      acceptedEvidenceIds: Object.freeze(row.evidence.map((evidence) => evidence.id)),
    });
  }
}
