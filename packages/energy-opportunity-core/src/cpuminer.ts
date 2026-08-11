import type { OpportunityDecision, Resource, WorkloadEstimate } from './index.ts';

export interface CpuminerConfig {
  executable: string;
  algorithm: 'sha256d' | 'scrypt';
  poolUrl: string;
  workerName: string;
  threads: number;
}

export interface CpuminerDryRun {
  mode: 'dry-run';
  command: string;
  args: string[];
  decision: OpportunityDecision;
}

function sanitizePoolUrl(poolUrl: string): string {
  try {
    const url = new URL(poolUrl);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    throw new Error('INVALID_POOL_URL');
  }
}

/**
 * Adapter boundary for pooler/cpuminer.
 *
 * This module deliberately never spawns a process, opens a socket, reads
 * credentials, or talks to a mining pool. It only produces a sanitized
 * execution plan after the deterministic policy decision has been made.
 * Real execution requires a future worker implementation plus Safeguard.
 */
export function planCpuminerDryRun(
  resource: Resource,
  estimate: WorkloadEstimate,
  decision: OpportunityDecision,
  config: CpuminerConfig,
): CpuminerDryRun {
  if (decision.decision !== 'start') {
    return {
      mode: 'dry-run',
      command: config.executable,
      args: [],
      decision,
    };
  }

  if (resource.kind !== 'cpu') {
    throw new Error('CPUMINER_REQUIRES_CPU_RESOURCE');
  }

  if (estimate.kind !== 'bitcoin-mining') {
    throw new Error('CPUMINER_REQUIRES_BITCOIN_WORKLOAD');
  }

  if (!Number.isInteger(config.threads) || config.threads < 1) {
    throw new Error('INVALID_THREAD_COUNT');
  }

  const args = [
    '-a', config.algorithm,
    '-o', sanitizePoolUrl(config.poolUrl),
    '-u', config.workerName,
    '-t', String(config.threads),
  ];

  return {
    mode: 'dry-run',
    command: config.executable,
    args,
    decision,
  };
}
