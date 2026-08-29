import type { CapabilityRegistry, JhadinaCapability } from "./capability-contract";

export class InMemoryCapabilityRegistry implements CapabilityRegistry {
  private readonly capabilities = new Map<string, JhadinaCapability>();

  register(capability: JhadinaCapability): void {
    this.capabilities.set(capability.id, capability);
  }

  list(): JhadinaCapability[] {
    return [...this.capabilities.values()];
  }

  async resolve(input: { task: string; instruction: string }): Promise<JhadinaCapability | null> {
    for (const capability of this.capabilities.values()) {
      if (await capability.canHandle(input)) return capability;
    }
    return null;
  }
}
