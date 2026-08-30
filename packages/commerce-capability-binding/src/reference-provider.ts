import type { CommerceCapabilityBinding } from "@jhadina/opportunity-contracts";

export interface ReferenceCommerceProvider {
  readonly name: string;
  readonly capabilities: ReadonlySet<string>;
  execute(
    binding: CommerceCapabilityBinding,
    input: unknown,
  ): Promise<unknown>;
}

export class InMemoryCommerceProvider implements ReferenceCommerceProvider {
  readonly name = "in-memory-reference";
  readonly capabilities = new Set<string>();
  readonly executions: Array<{ binding: CommerceCapabilityBinding; input: unknown }> = [];

  execute(binding: CommerceCapabilityBinding, input: unknown): Promise<unknown> {
    if (!this.capabilities.has(binding.capabilityName)) {
      throw new Error(`Provider does not implement capability: ${binding.capabilityName}`);
    }
    this.executions.push({ binding, input });
    return Promise.resolve({
      provider: this.name,
      capabilityName: binding.capabilityName,
      accepted: true,
      input,
    });
  }
}
