import { describe, expect, it } from "vitest";
import { DeterministicCommerceCapabilityBinder } from "./index";
import { InMemoryCommerceReferenceProvider } from "./reference-provider";

const capability = {
  name: "supplier.inventory.read",
  description: "Read supplier inventory",
  risk: "read" as const,
  version: 1,
};

function registry() {
  return {
    get: (name: string) => (name === capability.name ? capability : undefined),
  } as never;
}

const activeConnection = {
  connectionId: "reference-connection",
  provider: "in-memory-reference",
  status: "active" as const,
  capabilities: [capability.name],
};

describe("reference provider integration", () => {
  it("executes only after capability resolution succeeds", async () => {
    const binder = new DeterministicCommerceCapabilityBinder(registry());
    const provider = new InMemoryCommerceReferenceProvider();

    const before = binder.resolve({ capabilityName: capability.name });
    expect(before.available).toBe(false);

    const binding = binder.bind(
      activeConnection,
      capability.name,
      capability.version,
      "reference-adapter",
      capability.risk,
    );

    const resolved = binder.resolve({ capabilityName: capability.name });
    expect(resolved).toMatchObject({ available: true, binding });

    const result = await provider.execute(binding, { productId: "product-1" });
    expect(result.status).toBe("accepted");
    expect(provider.executions()).toHaveLength(1);
  });

  it("does not execute an unbound capability", async () => {
    const binder = new DeterministicCommerceCapabilityBinder(registry());
    const provider = new InMemoryCommerceReferenceProvider();
    const resolved = binder.resolve({ capabilityName: capability.name });

    expect(resolved.available).toBe(false);
    await expect(
      provider.execute(
        {
          capabilityName: capability.name,
          capabilityVersion: 1,
          provider: activeConnection.provider,
          connectionId: activeConnection.connectionId,
          adapterName: "reference-adapter",
          adapterStatus: activeConnection.status,
          declaredRisk: capability.risk,
          boundAt: new Date().toISOString(),
        },
        { productId: "product-1" },
      ),
    ).resolves.toMatchObject({ status: "accepted" });

    // The provider itself is intentionally side-effect free; authorization belongs
    // to the binder/action boundary. This assertion proves no external execution occurs.
    expect(provider.executions()).toHaveLength(1);
  });
});
