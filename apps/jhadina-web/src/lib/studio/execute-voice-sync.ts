import { QCHandler } from "./handlers/qc-handler";
import type { StudioActionRequest, StudioActionResult } from "./action-handlers";
import { createStudioProviderOrchestrator } from "./register-providers";

export async function executeVoiceSyncWorkflow(request: StudioActionRequest): Promise<StudioActionResult & { qcReportId?: string; timelineClipId?: string; provider?: string; fallbackUsed?: boolean }> {
  const orchestrator = createStudioProviderOrchestrator();

  try {
    const execution = await orchestrator.execute("lip-sync", {
      projectId: request.projectId,
      inputIds: request.inputIds,
      parameters: request.parameters,
    }, {
      preferred: request.parameters?.preferredProviders as string[] | undefined,
      allowFallback: request.parameters?.allowProviderFallback !== false,
      requireHealthyProvider: true,
    });

    const qc = await new QCHandler().execute({
      action: "qc",
      projectId: request.projectId,
      inputIds: execution.outputIds,
      parameters: { sourceAction: "voice-sync", voiceSyncMetrics: execution.metadata, provider: execution.selection },
    });

    return {
      action: "voice-sync",
      status: "complete",
      outputIds: execution.outputIds,
      qcRequired: true,
      message: qc.message,
      qcReportId: qc.outputIds[0],
      timelineClipId: `timeline:${request.projectId}:${execution.outputIds[0]}`,
      provider: execution.selection.provider,
      fallbackUsed: execution.selection.fallbackUsed,
    };
  } catch (error) {
    return { action: "voice-sync", status: "failed", outputIds: [], qcRequired: true, message: error instanceof Error ? error.message : "Voice-sync provider execution failed." };
  }
}
