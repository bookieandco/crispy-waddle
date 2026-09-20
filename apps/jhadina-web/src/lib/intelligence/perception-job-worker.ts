import {
  retryDelayMs,
  type PerceptionJob,
  type PerceptionJobAssetRepository,
  type PerceptionJobRepository,
} from "@jhadina/intelligence-core";
import type {
  MediaPipeline,
  SubsystemIntelligenceAdapter,
} from "@jhadina/intelligence-core";
import { GovernedSubsystemDispatcher } from "@jhadina/intelligence-core";

export type PerceptionWorkerOutcome =
  | { state: "idle" }
  | { state: "completed"; job: PerceptionJob }
  | { state: "needs_selection"; job: PerceptionJob }
  | { state: "retry_wait"; job: PerceptionJob }
  | { state: "failed"; job: PerceptionJob }
  | { state: "lease_lost"; job: PerceptionJob };

const TERMINAL_ERROR_MARKERS = [
  "PERCEPTION_ASSET_REFERENCE_INVALID",
  "PERCEPTION_ASSET_BUCKET_NOT_ALLOWED",
  "PERCEPTION_ASSET_SCOPE_MISMATCH",
  "PERCEPTION_WORKER_PRIVACY_INCOMPATIBLE",
  "PERCEPTION_WORKER_SCHEMA_INVALID",
  "PERCEPTION_WORKER_ASSET_MISMATCH",
  "PERCEPTION_WORKER_HASH_REQUIRED",
  "PERCEPTION_WORKER_HASH_MISMATCH",
  "PERCEPTION_WORKER_UNREQUESTED_OPERATION",
  "PERCEPTION_WORKER_OBSERVATION",
  "SUBSYSTEM_EVIDENCE_NOT_ASSET_BOUND",
  "SUBSYSTEM_RESPONSE_MISMATCH",
  "SUBSYSTEM_INBOX_EVIDENCE_NOT_ASSET_BOUND",
  "INTELLIGENCE_ASSET_ID_CONFLICT",
  "PERCEPTION_JOB_SELECTION_STALE",
];

function isTerminalError(message: string): boolean {
  return TERMINAL_ERROR_MARKERS.some((marker) => message.includes(marker));
}

export class PerceptionJobWorker {
  constructor(
    private readonly jobs: PerceptionJobRepository,
    private readonly assets: PerceptionJobAssetRepository,
    private readonly media: MediaPipeline,
    private readonly dispatcher: GovernedSubsystemDispatcher,
    private readonly workerId: string,
    private readonly leaseMs = 60_000,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!workerId.trim()) throw new Error("PERCEPTION_WORKER_ID_REQUIRED");
    if (!Number.isInteger(leaseMs) || leaseMs < 1000) throw new Error("PERCEPTION_WORKER_LEASE_INVALID");
  }

  async runNext(): Promise<PerceptionWorkerOutcome> {
    const claimed = await this.jobs.claimNext(this.workerId, this.leaseMs);
    if (!claimed) return { state: "idle" };
    if (!claimed.leaseToken || !claimed.leaseExpiresAt) {
      throw new Error("PERCEPTION_JOB_CLAIM_MISSING_LEASE");
    }

    const heartbeat = this.startHeartbeat(claimed);
    try {
      const asset = await this.assets.get(claimed.actorId, claimed.assetId);
      if (!asset) {
        const failed = await this.jobs.fail({
          jobId: claimed.id,
          workerId: this.workerId,
          leaseToken: claimed.leaseToken,
          error: "PERCEPTION_JOB_ASSET_NOT_FOUND",
        });
        return { state: "failed", job: failed ?? claimed };
      }

      let packet = await this.media.process({
        asset,
        intent: claimed.intent,
      });

      if (heartbeat.lost()) return { state: "lease_lost", job: claimed };

      if (claimed.selectedSubsystems?.length) {
        const selected = new Set(claimed.selectedSubsystems);
        const proposed = new Set(packet.routing.routes.map((route) => route.subsystem));
        if ([...selected].some((subsystem) => !proposed.has(subsystem))) {
          throw new Error("PERCEPTION_JOB_SELECTION_STALE");
        }
        packet = Object.freeze({
          ...packet,
          routing: Object.freeze({
            ...packet.routing,
            routes: Object.freeze(packet.routing.routes.filter((route) => selected.has(route.subsystem))),
            requiresHumanSelection: false,
          }),
        });
      }

      if (packet.routing.requiresHumanSelection) {
        const gated = await this.jobs.requireSelection({
          jobId: claimed.id,
          workerId: this.workerId,
          leaseToken: claimed.leaseToken,
          packet,
        });
        if (!gated) return { state: "lease_lost", job: claimed };
        return { state: "needs_selection", job: gated };
      }

      const dispatch = await this.dispatcher.dispatch(packet, claimed.intent);
      if (heartbeat.lost()) return { state: "lease_lost", job: claimed };

      const completed = await this.jobs.complete({
        jobId: claimed.id,
        workerId: this.workerId,
        leaseToken: claimed.leaseToken,
        packet,
        dispatch,
      });
      if (!completed) return { state: "lease_lost", job: claimed };
      return { state: "completed", job: completed };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (heartbeat.lost()) return { state: "lease_lost", job: claimed };

      if (isTerminalError(message)) {
        const failed = await this.jobs.fail({
          jobId: claimed.id,
          workerId: this.workerId,
          leaseToken: claimed.leaseToken,
          error: message,
        });
        if (!failed) return { state: "lease_lost", job: claimed };
        return { state: "failed", job: failed };
      }

      const availableAt = new Date(
        this.now().getTime() + retryDelayMs(claimed.attempt),
      ).toISOString();
      const retried = await this.jobs.retry({
        jobId: claimed.id,
        workerId: this.workerId,
        leaseToken: claimed.leaseToken,
        error: message,
        availableAt,
      });
      if (!retried) return { state: "lease_lost", job: claimed };
      return {
        state: retried.status === "failed" ? "failed" : "retry_wait",
        job: retried,
      };
    } finally {
      heartbeat.stop();
    }
  }

  private startHeartbeat(job: PerceptionJob): {
    stop: () => void;
    lost: () => boolean;
  } {
    let lost = false;
    const intervalMs = Math.max(250, Math.floor(this.leaseMs / 3));
    const timer = setInterval(() => {
      void this.jobs
        .renewLease(job.id, this.workerId, job.leaseToken!, this.leaseMs)
        .then((renewed) => {
          if (!renewed) lost = true;
        })
        .catch(() => {
          lost = true;
        });
    }, intervalMs);

    return {
      stop: () => clearInterval(timer),
      lost: () => lost,
    };
  }
}

export function createPerceptionDispatcher(
  adapters: readonly SubsystemIntelligenceAdapter[],
): GovernedSubsystemDispatcher {
  return new GovernedSubsystemDispatcher(adapters);
}
