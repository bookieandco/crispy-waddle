import type { StudioActionHandler, StudioActionRequest, StudioActionResult } from "../action-handlers";
import { sortForApplication, validateLoRAStack, type LoRAStack } from "../lora-registry";

export class LoRAHandler implements StudioActionHandler {
  readonly action = "lora-apply" as const;

  async execute(request: StudioActionRequest): Promise<StudioActionResult> {
    const stack = request.parameters?.loraStack as LoRAStack | undefined;
    if (!stack) return { action: this.action as never, status: "failed", outputIds: [], qcRequired: true, message: "A LoRA stack is required." };
    const warnings = validateLoRAStack(stack);
    if (warnings.length) return { action: this.action as never, status: "failed", outputIds: [], qcRequired: true, message: warnings.join(" ") };
    const ordered = sortForApplication(stack);
    return { action: this.action as never, status: "complete", outputIds: [`lora-stack:${request.projectId}:${Date.now()}`], qcRequired: true, message: `Prepared ${ordered.length} approved adapters for provider execution.` };
  }
}
