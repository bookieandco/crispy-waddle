import { describe, expect, it } from "vitest";
import { DailyEvolutionAudit, type DailyAuditSource } from "./daily-audit";

describe("DailyEvolutionAudit", () => {
  it("audits every domain and reports attention without executing changes", async () => {
    const seen: string[] = [];
    const source: DailyAuditSource = {
      id: "test",
      async audit(domain) {
        seen.push(domain);
        if (domain === "security") {
          return [{
            id: "sec-1",
            domain,
            severity: "high",
            code: "SECURITY_REVIEW_REQUIRED",
            title: "Security review required",
            detail: "A security finding requires user review.",
            recommendation: "Review the finding before making changes.",
            requiresApproval: true,
            observedAt: new Date().toISOString(),
          }];
        }
        return [];
      },
    };

    const report = await new DailyEvolutionAudit([source]).run(new Date("2026-08-09T08:00:00.000Z"));

    expect(report.status).toBe("attention");
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.requiresApproval).toBe(true);
    expect(new Set(seen).size).toBe(8);
  });
});
