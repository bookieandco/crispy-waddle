import type { SupabaseClient } from "@supabase/supabase-js";
import type { PodJob, PodJobStage, PodJobStatus } from "./workflow";

type DbJob = { id: string; creation_id: string; stage: PodJobStage; status: PodJobStatus; attempts: number; last_error: string | null; updated_at: string };

function mapJob(row: DbJob): PodJob {
  return { id: row.id, creationId: row.creation_id, stage: row.stage, status: row.status, attempts: row.attempts, lastError: row.last_error ?? undefined, updatedAt: row.updated_at };
}

export function createPodOperationsRepository(supabase: SupabaseClient) {
  return {
    async listJobs(): Promise<PodJob[]> {
      const { data, error } = await supabase.from("pupson_pod_jobs").select("id,creation_id,stage,status,attempts,last_error,updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as DbJob[]).map(mapJob);
    },
    async retryJob(jobId: string) {
      const { data, error } = await supabase.from("pupson_pod_jobs").update({ status: "queued", last_error: null }).eq("id", jobId).select("id,creation_id,stage,status,attempts,last_error,updated_at").single();
      if (error) throw error;
      return mapJob(data as DbJob);
    },
    subscribe(onJob: (job: PodJob) => void) {
      const channel = supabase.channel("pupson-pod-operations").on("postgres_changes", { event: "*", schema: "public", table: "pupson_pod_jobs" }, (payload) => { if (payload.new && "id" in payload.new) onJob(mapJob(payload.new as DbJob)); }).subscribe();
      return () => { void supabase.removeChannel(channel); };
    },
  };
}
