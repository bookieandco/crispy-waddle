import type { CapabilityInvoker, CapabilityInvocation } from "./command-contract";

export class CapabilityInvokerRegistry implements CapabilityInvoker {
  private readonly invokers = new Map<string, CapabilityInvoker>();

  register(capability: string, invoker: CapabilityInvoker): void {
    if (!capability.trim()) throw new Error("Capability name is required");
    if (this.invokers.has(capability)) throw new Error(`Invoker already registered: ${capability}`);
    this.invokers.set(capability, invoker);
  }

  async invoke(invocation: CapabilityInvocation): Promise<unknown> {
    const invoker = this.invokers.get(invocation.capability);
    if (!invoker) throw new Error(`No invoker registered: ${invocation.capability}`);
    return invoker.invoke(invocation);
  }
}
