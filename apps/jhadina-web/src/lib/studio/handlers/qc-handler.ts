import type { StudioActionHandler, StudioActionRequest, StudioActionResult } from "../action-handlers";

export interface VoiceSyncMetrics { syncOffsetMs: number; confidence: number; durationMs?: number; }

export class QCHandler implements StudioActionHandler {
  readonly action = "qc" as const;

  async execute(request: StudioActionRequest): Promise<StudioActionResult> {
    if (request.inputIds.length === 0) {
      return { action: this.action, status: "failed", outputIds: [], qcRequired: false, message: "QC needs at least one media or scene asset." };
    }

    const metrics = request.parameters?.voiceSyncMetrics as Partial<VoiceSyncMetrics> | undefined;
    const offset = metrics?.syncOffsetMs;
    const confidence = metrics?.confidence;
    const warnings: string[] = [];

    if (typeof offset === "number" && Math.abs(offset) > 80) warnings.push(`Lip-sync offset is ${Math.round(offset)} ms.`);
    if (typeof confidence === "number" && confidence < 0.85) warnings.push(`Lip-sync confidence is ${Math.round(confidence * 100)}%.`);

    const score = typeof offset === "number" && typeof confidence === "number"
      ? Math.max(0, Math.min(100, Math.round(confidence * 100 - Math.min(Math.abs(offset) / 10, 20))))
      : undefined;

    return {
      action: this.action,
      status: "complete",
      outputIds: [`qc-report:${request.projectId}:${Date.now()}`],
      qcRequired: false,
      message: score === undefined
        ? "QC report generated; awaiting provider synchronization metrics."
        : `Voice-sync QC score: ${score}/100${warnings.length ? ` — ${warnings.join(" ")}` : " — within configured thresholds."}`,
    };
  }
}
