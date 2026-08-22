import { describe, expect, it } from "vitest";
import { MockLoadProvider } from "./MockLoadProvider.js";

describe("MockLoadProvider", () => {
  it("returns deterministic demo opportunities", async () => {
    const provider = new MockLoadProvider();
    const loads = await provider.search({ origin: null });

    expect(loads.map((load) => load.id)).toEqual([
      "demo-houston-dallas",
      "demo-houston-austin",
      "demo-houston-sanantonio",
    ]);
  });

  it("filters by destination hint", async () => {
    const provider = new MockLoadProvider();
    const loads = await provider.search({ origin: null, destinationHint: "Dallas" });

    expect(loads).toHaveLength(1);
    expect(loads[0]?.destination).toBe("Dallas, TX");
  });

  it("honors the provider result cap", async () => {
    const provider = new MockLoadProvider();
    const loads = await provider.search({ origin: null, maxResults: 1 });

    expect(loads).toHaveLength(1);
  });

  it("clamps an excessive result cap to the dispatcher safety maximum", async () => {
    const provider = new MockLoadProvider();
    const loads = await provider.search({ origin: null, maxResults: 1000 });

    expect(loads.length).toBeLessThanOrEqual(25);
  });
});
