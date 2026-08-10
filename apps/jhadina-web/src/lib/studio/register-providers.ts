import { StudioProviderAdapter } from "./provider-adapters";
import { StudioProviderOrchestrator } from "./provider-orchestrator";
import { Wav2LipProvider } from "./providers/wav2lip-provider";

export function createStudioProviderOrchestrator(extraProviders: StudioProviderAdapter[] = []): StudioProviderOrchestrator {
  return new StudioProviderOrchestrator([
    new Wav2LipProvider(),
    ...extraProviders,
  ]);
}
