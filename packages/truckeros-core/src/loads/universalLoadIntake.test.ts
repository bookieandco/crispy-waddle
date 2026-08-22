import { describe, expect, it } from "vitest";
import { parseLoadCsvRow, parseLoadText } from "./universalLoadIntake";

describe("universal load intake", () => {
  it("normalizes a natural-language load", () => {
    const result = parseLoadText("Houston TX -> Dallas TX, $2,100, 312 miles", new Date("2026-08-22T12:00:00Z"));
    expect(result.load.origin).toBe("Houston TX");
    expect(result.load.destination).toBe("Dallas TX");
    expect(result.load.grossPay).toBe(2100);
    expect(result.load.loadedMiles).toBe(312);
    expect(result.load.source.type).toBe("manual");
  });

  it("rejects incomplete natural-language loads", () => {
    expect(() => parseLoadText("Houston to Dallas, $2,100")).toThrow("LOAD_MILES_NOT_FOUND");
  });

  it("normalizes CSV-style records and preserves provenance", () => {
    const result = parseLoadCsvRow({
      id: "load-1",
      origin: "Houston TX",
      destination: "Dallas TX",
      grossPay: "2100",
      loadedMiles: "312",
      deadheadMiles: "48",
      equipment: "dry van",
      provider: "imported_board",
      externalId: "ext-1",
    }, new Date("2026-08-22T12:00:00Z"));

    expect(result.load.deadheadMiles).toBe(48);
    expect(result.load.source.provider).toBe("imported_board");
    expect(result.load.source.externalId).toBe("ext-1");
  });

  it("rejects invalid CSV economics inputs", () => {
    expect(() => parseLoadCsvRow({ origin: "Houston", destination: "Dallas", grossPay: "0", loadedMiles: "312" }))
      .toThrow("CSV_GROSS_PAY_INVALID");
  });
});
