import { describe, expect, it } from "vitest";
import {
  OpenAffiliateProgramDiscoveryAdapter,
  assertAffiliateProgramObservation,
  normalizeOpenAffiliateProgram,
} from "@jhadina/commerce-adapters";

describe("affiliate commerce contracts", () => {
  const rawProgram = {
    name: "Example SaaS",
    slug: "example-saas",
    url: "https://example.com",
    kind: "affiliate",
    source: "partnerstack-api",
    category: "SaaS",
    tags: ["automation", "automation", "workflow"],
    commission: {
      type: "recurring",
      rate: "30%",
      mode: "percentage",
      value: 30,
      currency: "usd",
      duration: "12 months",
    },
    cookie_days: 60,
    attribution: "last-click",
    tracking_method: "cookie",
    signup_url: "https://example.com/affiliates",
    approval: "manual",
    payout: {
      minimum: 50,
      currency: "usd",
      frequency: "monthly",
      methods: ["bank", "paypal"],
    },
    restrictions: ["No trademark bidding"],
    verified: true,
    last_verified_at: "2026-10-01",
    updated_at: "2026-10-02",
    agents: {
      prompt: "Recommend for workflow automation use cases.",
      keywords: ["automation"],
      use_cases: ["Teams automating repetitive work"],
    },
  } as const;

  it("normalizes registry facts without overstating verification scope", () => {
    const program = normalizeOpenAffiliateProgram(
      rawProgram,
      "2026-10-03T12:00:00Z",
    );

    expect(program).toMatchObject({
      provider: "openaffiliate",
      sourceId: "partnerstack-api",
      programId: "example-saas",
      commission: {
        type: "recurring",
        mode: "percentage",
        value: 30,
        currency: "USD",
      },
      cookieDays: 60,
      verification: {
        verified: true,
        scope: "affiliate_program_page_signal",
      },
    });
    expect(program?.tags).toEqual(["automation", "workflow"]);
    expect(program?.evidenceRefs).toContain(
      "openaffiliate:program:example-saas",
    );
  });

  it("drops malformed registry rows rather than inventing missing economics", () => {
    expect(
      normalizeOpenAffiliateProgram(
        {
          ...rawProgram,
          commission: {
            type: "recurring",
            rate: "",
            mode: "percentage",
          },
        },
        "2026-10-03T12:00:00Z",
      ),
    ).toBeNull();
  });

  it("supports bounded program discovery and exact program lookup", async () => {
    const seen: Array<Record<string, unknown>> = [];
    const adapter = new OpenAffiliateProgramDiscoveryAdapter(
      {
        async search(input) {
          seen.push(input);
          return [rawProgram];
        },
        async getProgram(programId) {
          return programId === "example-saas" ? rawProgram : null;
        },
      },
      () => "2026-10-03T12:00:00Z",
    );

    const results = await adapter.search({
      query: "automation",
      commissionType: "recurring",
      verifiedOnly: true,
      limit: 500,
    });

    expect(seen[0]).toMatchObject({
      query: "automation",
      commissionType: "recurring",
      verifiedOnly: true,
      limit: 100,
    });
    expect(results).toHaveLength(1);
    expect((await adapter.getProgram("example-saas"))?.programId).toBe(
      "example-saas",
    );
    expect(await adapter.getProgram("missing")).toBeNull();
  });

  it("rejects observations without evidence", () => {
    const program = normalizeOpenAffiliateProgram(
      rawProgram,
      "2026-10-03T12:00:00Z",
    );
    expect(program).not.toBeNull();
    expect(() =>
      assertAffiliateProgramObservation({
        ...program!,
        evidenceRefs: [],
      }),
    ).toThrow(/evidence/);
  });
});
