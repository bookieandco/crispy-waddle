import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { CapabilityInvoker, CapabilityInvocation } from "./command-contract";
import { resolveCapability } from "./capability-adapter";
import type { MediaProcessorPort, AudioEditOperation } from "./media-processor-port";

export const AUDIO_EDIT_CAPABILITY = "audio.edit";

export function registerAudioEditCapability(registry: CapabilityRegistry): void {
  registry.register({
    name: AUDIO_EDIT_CAPABILITY,
    description: "Apply an approved audio transformation to a media file.",
    risk: "write",
    version: 1,
  });
}

export class AudioEditCapabilityInvoker implements CapabilityInvoker {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly processor: MediaProcessorPort,
  ) {}

  async invoke(invocation: CapabilityInvocation): Promise<unknown> {
    resolveCapability(this.registry, invocation);
    if (invocation.capability !== AUDIO_EDIT_CAPABILITY) {
      throw new Error(`Unsupported audio capability: ${invocation.capability}`);
    }

    const args = invocation.arguments;
    const operation = args.operation;
    if (operation !== "bass_reduce" && operation !== "vocal_clean") {
      throw new Error(`Unsupported audio edit operation: ${String(operation)}`);
    }
    if (typeof args.sourcePath !== "string" || !args.sourcePath.trim()) {
      throw new Error("audio.edit requires sourcePath");
    }

    return this.processor.process({
      sourcePath: args.sourcePath,
      outputPath: typeof args.outputPath === "string" ? args.outputPath : undefined,
      operation: operation as AudioEditOperation,
    });
  }
}
