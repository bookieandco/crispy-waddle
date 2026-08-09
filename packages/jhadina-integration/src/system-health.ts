export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface HostMetrics {
  collectedAt: string;
  cpuUtilization?: number;
  memoryUtilization?: number;
  filesystemUtilization?: number;
  networkBytesPerSecond?: number;
  loadAverage?: number[];
  labels?: Record<string, string>;
}

export interface SystemHealthSnapshot {
  status: HealthStatus;
  host: HostMetrics;
  services: Record<string, HealthStatus>;
  activeJobs: number;
  queuedJobs: number;
  warnings: string[];
}

/** Adapter boundary for Prometheus/node_exporter or another host-metrics source. */
export interface SystemHealthProvider {
  getSnapshot(): Promise<SystemHealthSnapshot>;
}

export function classifyHostLoad(metrics: HostMetrics): HealthStatus {
  const values = [metrics.cpuUtilization, metrics.memoryUtilization, metrics.filesystemUtilization].filter(
    (value): value is number => typeof value === 'number',
  );

  if (values.some((value) => value >= 95)) return 'critical';
  if (values.some((value) => value >= 85)) return 'degraded';
  if (values.length === 0) return 'unknown';
  return 'healthy';
}
