import { QCHandler } from "./handlers/qc-handler";
import { StudioActionRequest, StudioActionResult } from "./action-handlers";
import { ProviderRegistry } from "./provider-adapters";
import { VoiceSyncProvider } from "./providers/voice-sync-provider";

export async function executeVoiceSyncWorkflow(request: StudioActionRequest): Promise<StudioActionResult & { qcReportId?: string; timelineClipId?: string }> {
  const providers = new ProviderRegistry();
  providers.register(new VoiceSyncProvider());
  const provider = await providers.choose("lip-sync");

  if (!provider) {
    return { action: "voice-sync", status: "failed", outputIds: [], qcRequired: true, message: "No lip-sync provider is available." };
  }

  const output = await provider.execute({ projectId: request.projectId, inputIds: request.inputIds, parameters: request.parameters });
  const qc = await new QCHandler().execute({ action: "qc", projectId: request.projectId, inputIds: output.outputIds, parameters: { sourceAction: "voice-sync" } });

  return {
    action: "voice-sync",
    status: "complete",
    outputIds: output.outputIds,
    qcRequired: true,
    message: "Voice-sync provider completed the workflow handoff; QC is attached for review before approval.",
    qcReportId: qc.outputIds[0],
    timelineClipId: `timeline:${request.projectId}:${output.outputIds[0]}`,
  };
}
