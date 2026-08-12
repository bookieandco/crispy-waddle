import { ProviderRegistry } from "./provider-adapters";
import { VoiceSyncFallbackProvider } from "./providers/voice-sync-fallback-provider";
import { Wav2LipProvider } from "./providers/wav2lip-provider";

export function createStudioProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new Wav2LipProvider());
  registry.register(new VoiceSyncFallbackProvider());
  return registry;
}
