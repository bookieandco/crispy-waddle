import type { CommerceCapabilityBinding } from "@jhadina/opportunity-contracts";
import type { CommerceExecutionReceipt } from "./execution-receipt";

export interface ReferenceCommerceProvider {
  readonly name: string;
  readonly capabilities: ReadonlySet<string>;
  execute(
    binding: CommerceCapabilityBinding,
    receipt: CommerceExecutionReceipt,
    input: unknown,
  ): Promise<unknown>;
}

export class InMemoryCommerceProvider implements ReferenceCommerceProvider {
  readonly name = "in-memory-reference";
  readonly capabilities = new Set<string>();
  readonly executions: Array<{
    binding: CommerceCapabilityBinding;
    receipt: CommerceExecutionReceipt;
    input: unknown;
  }> = [];

  constructor(
    private readonly verifyReceipt: (
      receipt: CommerceExecutionReceipt,
      binding: CommerceCapabilityBinding,
    ) => boolean,
  ) {}

  execute(
    binding: CommerceCapabilityBinding,
    receipt: CommerceExecutionReceipt,
    input: unknown,
  ): Promise<unknown> {
    if (!this.verifyReceipt(receipt, binding)) {
      throw new Error("Commerce execution receipt is invalid or expired");
    }
    if (!this.capabilities.has(binding.capabilityName)) {
      throw new Error(`Provider does not implement capability: ${binding.capabilityName}`);
    }
    this.executions.push({ binding, receipt, input });
    return Promise.resolve({
      provider: this.name,
      capabilityName: binding.capabilityName,
      accepted: true,
      input,
    });
  }
}
