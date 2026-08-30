export type WorkerTrust = 'untrusted' | 'quarantined' | 'trusted-compute';

export type WorkerJob = {
  jobId: string;
  workerId: string;
  capability: string;
  inputObjectIds: readonly string[];
  outputPrefix: string;
  expiresAt: number;
};

export type WorkerPolicy = {
  allowedCapabilities: readonly string[];
  maxJobTtlMs: number;
  allowNetwork: boolean;
  allowSecrets: false;
  allowControlPlaneWrites: false;
};

export type WorkerAuthorization =
  | { decision: 'allow'; job: WorkerJob }
  | { decision: 'deny'; reason: string };

/**
 * Remote compute is an untrusted workload boundary. A worker receives only
 * scoped job metadata and object references; it never receives owner/session
 * credentials, approval authority, policy-writing authority, or raw secrets.
 */
export class RemoteWorkerBoundary {
  constructor(private readonly policy: WorkerPolicy) {}

  authorize(job: WorkerJob, now = Date.now()): WorkerAuthorization {
    if (!job.jobId || !job.workerId || !job.capability) return { decision: 'deny', reason: 'invalid_job' };
    if (job.expiresAt <= now) return { decision: 'deny', reason: 'job_expired' };
    if (job.expiresAt - now > this.policy.maxJobTtlMs) return { decision: 'deny', reason: 'job_ttl_exceeded' };
    if (!this.policy.allowedCapabilities.includes(job.capability)) return { decision: 'deny', reason: 'worker_capability_denied' };
    if (job.outputPrefix.includes('..') || job.outputPrefix.startsWith('/')) return { decision: 'deny', reason: 'unsafe_output_prefix' };
    return { decision: 'allow', job: { ...job, inputObjectIds: [...job.inputObjectIds] } };
  }

  static defaultPolicy(): WorkerPolicy {
    return {
      allowedCapabilities: ['take.generate', 'take.regenerate', 'audio.edit', 'image.edit', 'research.run'],
      maxJobTtlMs: 15 * 60_000,
      allowNetwork: false,
      allowSecrets: false,
      allowControlPlaneWrites: false,
    };
  }
}
