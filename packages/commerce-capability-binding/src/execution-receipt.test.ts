import { describe, expect, it } from "vitest";
import { DeterministicCommerceExecutionAuthorizer } from "./execution-receipt";
import { InMemoryCommerceProvider } from "./reference-provider";

const binding = {
  capabilityName: "supplier.inventory.read",
  capabilityVersion: 1,
  provider: "in-memory-reference",
  connectionId: "conn-1",
  adapterName: "reference-adapter",
  adapterStatus: "active" as const,
  declaredRisk: "read" as const,
  boundAt: new Date().toISOString(),
};

describe("authorization-bound provider execution", () => {
  it("accepts a valid receipt", async () => {
    const authorizer = new DeterministicCommerceExecutionAuthorizer();
    const receipt = authorizer.issue(binding);
    const provider = new InMemoryCommerceProvider(authorizer.verify.bind(authorizer));
    provider.capabilities.add(binding.capabilityName);

    await expect(provider.execute(binding, receipt, { productId: "p1" })).resolves.toMatchObject({
      accepted: true,
    });
  });

  it("rejects a mismatched binding", async () => {
    const authorizer = new DeterministicCommerceExecutionAuthorizer();
    const receipt = authorizer.issue(binding);
    const provider = new InMemoryCommerceProvider(authorizer.verify.bind(authorizer));
    provider.capabilities.add(binding.capabilityName);
    const changed = { ...binding, connectionId: "other-connection" };

    await expect(provider.execute(changed, receipt, {})).rejects.toThrow("receipt");
  });

  it("rejects an expired receipt", async () => {
    const authorizer = new DeterministicCommerceExecutionAuthorizer();
    const receipt = authorizer.issue(binding, -1);
    const provider = new InMemoryCommerceProvider(authorizer.verify.bind(authorizer));
    provider.capabilities.add(binding.capabilityName);

    await expect(provider.execute(binding, receipt, {})).rejects.toThrow("receipt");
  });
});
