import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetIntelligencePacket,
  PerceptionJob,
  PerceptionJobRepository,
  SubsystemDispatchResult,
} from "@jhadina/intelligence-core";

type JobRow = {
  id: string;
  actor_id: string;
  asset_id: string;
  intent: string | null;
  status: PerceptionJob["status"];
  attempt: number;
  max_attempts: number;
  available_at: string;
  lease_owner: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  last_error: string | null;
  packet: AssetIntelligencePacket | null;
  dispatch: SubsystemDispatchResult | null;
  created_at: string;
  updated_at: string;
};

function toJob(row: JobRow): PerceptionJob {
  return {
    id: row.id,
    actorId: row.actor_id,
    assetId: row.asset_id,
    intent: row.intent ?? undefined,
    status: row.status,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    availableAt: row.available_at,
    leaseOwner: row.lease_owner ?? undefined,
    leaseToken: row.lease_token ?? undefined,
    leaseExpiresAt: row.lease_expires_at ?? undefined,
    lastError: row.last_error ?? undefined,
    packet: row.packet ?? undefined,
    dispatch: row.dispatch ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabasePerceptionJobRepository implements PerceptionJobRepository {
  constructor(private readonly client: SupabaseClient) {}

  async enqueue(input: {
    id: string;
    actorId: string;
    assetId: string;
    intent?: string;
    maxAttempts: number;
  }): Promise<PerceptionJob> {
    const { data, error } = await this.client.rpc("enqueue_jhadina_perception_job", {
      p_id: input.id,
      p_actor_id: input.actorId,
      p_asset_id: input.assetId,
      p_intent: input.intent ?? "",
      p_max_attempts: input.maxAttempts,
    });
    if (error) throw error;
    if (!data) throw new Error("PERCEPTION_JOB_ENQUEUE_FAILED");
    const job = toJob(data as JobRow);
    if (job.id !== input.id || job.actorId !== input.actorId || job.assetId !== input.assetId) {
      throw new Error("PERCEPTION_JOB_IDENTITY_CONFLICT");
    }
    if ((job.intent ?? "") !== (input.intent ?? "")) throw new Error("PERCEPTION_JOB_INTENT_CONFLICT");
    if (job.maxAttempts !== input.maxAttempts) throw new Error("PERCEPTION_JOB_RETRY_POLICY_CONFLICT");
    return job;
  }

  async claimNext(workerId: string, leaseMs: number): Promise<PerceptionJob | undefined> {
    const { data, error } = await this.client.rpc("claim_next_jhadina_perception_job", {
      p_worker_id: workerId,
      p_lease_ms: leaseMs,
    });
    if (error) throw error;
    return data ? toJob(data as JobRow) : undefined;
  }

  async renewLease(jobId: string, workerId: string, leaseToken: string, leaseMs: number) {
    const { data, error } = await this.client.rpc("renew_jhadina_perception_job_lease", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_token: leaseToken,
      p_lease_ms: leaseMs,
    });
    if (error) throw error;
    return data ? toJob(data as JobRow) : undefined;
  }

  async requireSelection(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    packet: AssetIntelligencePacket;
  }) {
    const { data, error } = await this.client.rpc("require_jhadina_perception_job_selection", {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_packet: input.packet,
    });
    if (error) throw error;
    return data ? toJob(data as JobRow) : undefined;
  }

  async complete(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    packet: AssetIntelligencePacket;
    dispatch: SubsystemDispatchResult;
  }) {
    const { data, error } = await this.client.rpc("complete_jhadina_perception_job", {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_packet: input.packet,
      p_dispatch: input.dispatch,
    });
    if (error) throw error;
    return data ? toJob(data as JobRow) : undefined;
  }

  async retry(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    error: string;
    availableAt: string;
  }) {
    const { data, error } = await this.client.rpc("retry_jhadina_perception_job", {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_error: input.error,
      p_available_at: input.availableAt,
    });
    if (error) throw error;
    return data ? toJob(data as JobRow) : undefined;
  }

  async fail(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    error: string;
  }) {
    const { data, error } = await this.client.rpc("fail_jhadina_perception_job", {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_lease_token: input.leaseToken,
      p_error: input.error,
    });
    if (error) throw error;
    return data ? toJob(data as JobRow) : undefined;
  }

  async requeueWithIntent(input: {
    actorId: string;
    jobId: string;
    intent: string;
  }) {
    const { data, error } = await this.client.rpc("requeue_jhadina_perception_job_with_intent", {
      p_actor_id: input.actorId,
      p_job_id: input.jobId,
      p_intent: input.intent,
    });
    if (error) throw error;
    return data ? toJob(data as JobRow) : undefined;
  }

  async get(actorId: string, jobId: string) {
    const { data, error } = await this.client
      .from("jhadina_perception_jobs")
      .select("*")
      .eq("actor_id", actorId)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    return data ? toJob(data as JobRow) : undefined;
  }
}
