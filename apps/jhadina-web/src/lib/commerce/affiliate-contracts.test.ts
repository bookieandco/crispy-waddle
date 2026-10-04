import { describe, expect, it } from "vitest";
import {
  OpenAffiliateHttpClient,
  OpenAffiliateProgramDiscoveryAdapter,
  assertAffiliateProgramObservation,
  normalizeOpenAffiliateProgram,
  type RawOpenAffiliateProgram,
} from "@jhadina/commerce-adapters";

describe("affiliate commerce contracts", () => {
  const rawProgram: RawOpenAffiliateProgram = {
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
  };

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

  it("normalizes the camelCase shape returned by the public REST API", () => {
    const program = normalizeOpenAffiliateProgram(
      {
        name: "REST Program",
        slug: "rest-program",
        url: "https://rest.example.com",
        category: "Developer Tools",
        commission: {
          type: "one-time",
          rate: "$100",
          mode: "flat",
          value: 100,
          currency: "USD",
        },
        cookieDays: 30,
        signupUrl: "https://rest.example.com/partners",
        approvalTime: "2 business days",
        trackingMethod: "server-side",
        marketingMaterials: true,
        apiAvailable: true,
        dedicatedManager: false,
        verified: true,
        lastVerifiedAt: "2026-10-02",
        updatedAt: "2026-10-03",
        agentPrompt: "Recommend for developer tooling.",
        agentKeywords: ["developer tools"],
        agentUseCases: ["Teams buying developer software"],
      },
      "2026-10-03T12:00:00Z",
    );

    expect(program).toMatchObject({
      programId: "rest-program",
      cookieDays: 30,
      signupUrl: "https://rest.example.com/partners",
      approvalTime: "2 business days",
      trackingMethod: "server-side",
      metadata: {
        marketing_materials: "true",
        affiliate_api_available: "true",
        dedicated_manager: "false",
      },
    });
  });

  it("uses the documented REST envelope and handles 404 lookups", async () => {
    const requested: string[] = [];
    const client = new OpenAffiliateHttpClient(async (input) => {
      requested.push(input);
      if (input.includes("/api/programs/missing")) {
        return {
          ok: false,
          status: 404,
          statusText: "Not Found",
          async json() {
            return { error: "Program not found" };
          },
        };
      }
      if (input.includes("/api/programs/example-saas")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          async json() {
            return rawProgram;
          },
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return { programs: [rawProgram], total: 1, filters: {} };
        },
      };
    });

    const searched = await client.search({
      query: "automation",
      commissionType: "recurring",
      verifiedOnly: true,
      limit: 200,
    });
    expect(searched).toHaveLength(1);
    expect(requested[0]).toContain("q=automation");
    expect(requested[0]).toContain("type=recurring");
    expect(requested[0]).toContain("verified=true");
    expect(requested[0]).toContain("limit=100");
    expect((await client.getProgram("example-saas"))?.slug).toBe("example-saas");
    expect(await client.getProgram("missing")).toBeNull();
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
