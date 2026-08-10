import { StudioHandlerRegistry } from "./action-handlers";
import { QCHandler } from "./handlers/qc-handler";
import { VoiceSyncHandler } from "./handlers/voice-sync-handler";
import { AnimationHandler, CharacterReplacementHandler, RenderHandler, RigHandler } from "./handlers/visual-handlers";

export function createStudioHandlerRegistry(): StudioHandlerRegistry {
  const registry = new StudioHandlerRegistry();
  registry.register(new VoiceSyncHandler());
  registry.register(new QCHandler());
  registry.register(new CharacterReplacementHandler());
  registry.register(new RigHandler());
  registry.register(new AnimationHandler());
  registry.register(new RenderHandler());
  return registry;
}
