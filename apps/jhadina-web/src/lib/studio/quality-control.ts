export type QCDimension = "lip-sync" | "face" | "rig" | "tracking" | "camera" | "lighting" | "depth" | "color" | "motion" | "audio" | "render";
export type Severity = "info" | "warning" | "critical";

export interface QCMetric { dimension: QCDimension; score: number; severity: Severity; affectedFrames?: [number, number]; message: string; autoFixable: boolean; }
export interface QCReport { id: string; sceneId: string; overallScore: number; metrics: QCMetric[]; generatedAt: string; status: "draft" | "needs-review" | "passed" | "approved"; }
export interface FineTuneJob { id: string; sceneId: string; metric: QCDimension; frameRange?: [number, number]; parameter: string; before: number; after?: number; status: "proposed" | "running" | "complete" | "failed"; requiresApproval: boolean; }

export function createQCReport(sceneId: string, metrics: QCMetric[]): QCReport {
  const overallScore = metrics.length ? Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length) : 0;
  const status = metrics.some((m) => m.severity === "critical") ? "needs-review" : overallScore >= 90 ? "passed" : "needs-review";
  return { id: crypto.randomUUID(), sceneId, overallScore, metrics, generatedAt: new Date().toISOString(), status };
}

export function createFineTuneJob(input: Omit<FineTuneJob, "id" | "status">): FineTuneJob {
  return { ...input, id: crypto.randomUUID(), status: "proposed" };
}
