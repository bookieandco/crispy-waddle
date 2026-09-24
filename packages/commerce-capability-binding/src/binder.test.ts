import { describe, expect, it } from "vitest";
import { DeterministicCommerceCapabilityBinder } from "./index";

const definition = {
  name: "supplier.inventory.read",
  description: "Read supplier inventory",
  risk: "read" as const,
  version: 1,
};

function registry() {
  return {
    get: (name: string) => (name === definition.name ? definition : undefined),
    register: () => undefined,
    list: () => [definition],
  } as never;
}

function connection(status: "active" | "pending" | "degraded" | "revoked" = "active") {
  return {
    connectionId: "conn-1",
    provider: "test-provider",
    status,
    capabilities: [definition.name],
  } as never;
}

describe("DeterministicCommerceCapabilityBinder", () => {
  it("binds a registered capability on an active connection", () => {
    const binder = new DeterministicCommerceCapabilityBinder(registry());
    const binding = binder.bind(connection(), definition.name, 1, "adapter", "read");
    expect(binding.capabilityName).toBe(definition.name);
    expect(binding.declaredRisk).toBe("read");
    expect(binder.resolve({ capabilityName: definition.name }).available).toBe(true);
  });

  it("rejects an unknown capability", () => {
    const binder = new DeterministicCommerceCapabilityBinder(registry());
    expect(() => binder.bind(connection(), "unknown", 1, "adapter", "read")).toThrow();
    expect(binder.resolve({ capabilityName: "unknown" })).toEqual({
      available: false,
      reason: "not_registered",
    });
  });

  it("rejects a version mismatch at bind time", () => {
    const binder = new DeterministicCommerceCapabilityBinder(registry());
    expect(() => binder.bind(connection(), definition.name, 2, "adapter", "read")).toThrow();
  });

  it.each(["pending", "degraded", "revoked"] as const)(
    "rejects a %s connection",
    (status) => {
      const binder = new DeterministicCommerceCapabilityBinder(registry());
      expect(() => binder.bind(connection(status), definition.name, 1, "adapter", "read")).toThrow();
    },
  );

  it("rejects a capability not declared by the connection", () => {
    const binder = new DeterministicCommerceCapabilityBinder(registry());
    const disconnected = {
      ...connection(),
      capabilities: [],
    } as never;
    expect(() => binder.bind(disconnected, definition.name, 1, "adapter", "read")).toThrow();
  });

  it("rejects provider risk that differs from canonical registry risk", () => {
    const binder = new DeterministicCommerceCapabilityBinder(registry());
    expect(() => binder.bind(connection(), definition.name, 1, "adapter", "financial")).toThrow();
  });

  it("cannot resolve a capability without a provider binding", () => {
    const binder = new DeterministicCommerceCapabilityBinder(registry());
    expect(binder.resolve({ capabilityName: definition.name })).toEqual({
      available: false,
      reason: "no_provider",
    });
  });
});
