import { describe, expect, it } from "vitest";
import { TemplateDispatcherReasoner } from "./TemplateDispatcherReasoner.js";
import { DispatcherService } from "../services/DispatcherService.js";
import type { DispatcherContext, LoadOffer } from "../interfaces/dispatcher.js";

const load = (overrides: Partial<LoadOffer> = {}): LoadOffer => ({
  id: "load-1",
  origin: "Houston, TX",
  destination: "Dallas, TX",
  pickupAt: null,
  deliveryAt: null,
  revenueCents: 210_000,
  loadedMiles: 240,
  deadheadMiles: 40,
  fuelCostCents: 31_000,
  tollCostCents: 4_800,
  otherCostCents: 7_500,
  brokerName: "Example Broker",
  ...overrides,
});

const context = (loads: LoadOffer[]): DispatcherContext => ({
  driver: {
    id: "driver-1",
    name: "Driver",
    truckType: "tractor-trailer",
    homeBaseLocation: null,
    currentLocation: null,
    preferredRadiusMeters: 16_000,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  currentLocation: null,
  loads,
  minimumNetCentsPerMile: 400,
  targetNetCentsPerMile: 500,
});

describe("TemplateDispatcherReasoner", () => {
  const dispatcher = new DispatcherService();
  const reasoner = new TemplateDispatcherReasoner();

  it("never fabricates a dollar figure that isn't already in the brief", async () => {
    const brief = dispatcher.brief(context([load()]));
    const explanation = await reasoner.explain(brief, "Should I take this load?");

    // Every dollar amount mentioned in the explanation must trace back to
    // something the deterministic service actually computed and put in
    // the headline or a candidate's reasons — not a number the "AI" layer
    // introduced on its own.
    const dollarAmounts = explanation.match(/\$\d+(\.\d+)?/g) ?? [];
    const sourceText = `${brief.headline} ${brief.candidates.flatMap((c) => c.reasons).join(" ")}`;
    for (const amount of dollarAmounts) {
      expect(sourceText.includes(amount) || brief.headline.includes(amount)).toBe(true);
    }
  });

  it("echoes the driver's question back verbatim rather than reinterpreting it", async () => {
    const brief = dispatcher.brief(context([load()]));
    const explanation = await reasoner.explain(brief, "  Why this one over the others?  ");
    expect(explanation).toContain('You asked: "Why this one over the others?"');
  });

  it("always states that nothing is booked without driver approval", async () => {
    const brief = dispatcher.brief(context([load()]));
    const explanation = await reasoner.explain(brief);
    expect(explanation.toLowerCase()).toContain("nothing is committed until you approve it");
  });

  it("mentions the runner-up when more than one load is evaluated", async () => {
    const strong = load({ id: "strong", revenueCents: 220_000 });
    const weak = load({ id: "weak", revenueCents: 130_000 });
    const brief = dispatcher.brief(context([weak, strong]));

    const explanation = await reasoner.explain(brief);
    expect(explanation).toContain("1 other load was also evaluated");
  });

  it("handles an empty brief without throwing or asserting an approval line that implies a load exists", async () => {
    const brief = dispatcher.brief(context([]));
    const explanation = await reasoner.explain(brief);
    expect(explanation).toContain("I don't have any loads to evaluate yet.");
    expect(explanation.toLowerCase()).not.toContain("nothing is committed");
  });
});
