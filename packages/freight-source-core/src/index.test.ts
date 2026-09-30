import { describe, expect, it, vi } from "vitest";
import { FreightSourceRegistry, type FreightSourceAdapter } from "./index";

function adapter(source: string): FreightSourceAdapter {
  return {
    source,
    search: vi.fn(async () => [{ source, sourceLoadId: `${source}-1`, origin: "Charlotte, NC", destination: "Atlanta, GA" }]),
    health: vi.fn(async (checkedAt) => ({ source, healthy: true, checkedAt })),
  };
}

describe("FreightSourceRegistry", () => {
  it("registers independent providers and aggregates normalized loads", async () => {
    const registry = new FreightSourceRegistry();
    registry.register(adapter("dat"));
    registry.register(adapter("truckstop"));

    const loads = await registry.search({ carrierId: "carrier-1", equipment: "dry_van" });
    expect(registry.list()).toEqual(["dat", "truckstop"]);
    expect(loads.map((load) => load.source)).toEqual(["dat", "truckstop"]);
  });

  it("rejects duplicate provider names", () => {
    const registry = new FreightSourceRegistry();
    registry.register(adapter("dat"));
    expect(() => registry.register(adapter("dat"))).toThrow("Freight source already registered: dat");
  });
});
