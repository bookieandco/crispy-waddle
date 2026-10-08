import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AskMakeItMakeSenseReceipt } from "@jhadina/intelligence-core";
import { MimsAdvisoryCard } from "./mims-advisory-card";

const dimensions = [
  "EVIDENCE", "CHRONOLOGY", "CAUSAL_LOGIC", "INCENTIVES",
  "BASE_RATES", "CONTRADICTIONS", "ALTERNATIVES",
] as const;

function preliminary(): AskMakeItMakeSenseReceipt {
  return {
    stage: "ASK_JHADINA",
    authority: "ADVISORY_ONLY",
    canAuthorizeAction: false,
    assessmentScope: "PRELIMINARY_EVIDENCE_DISCIPLINE",
    independentFactCheckPerformed: false,
    vote: {
      schemaVersion: "JHADINA-MIMS-01",
      voteId: "ask-mims:fixture",
      subjectId: "ctx:fixture",
      status: "REVIEW",
      reasonCodes: dimensions.map((d) => d + "_REVIEW"),
      coherentNotEquivalentToTrue: true,
      independentValidationStillRequired: true,
      authority: "ADVISORY_ONLY",
      checks: dimensions.map((dimension) => ({
        dimension,
        status: "REVIEW" as const,
        rationale: "Independent support not yet verified",
        evidenceRefs: [],
      })),
    },
  };
}

describe("phone Make It Make Sense readout", () => {
  it("makes an absent or shortcut-only assessment explicitly Not evaluated", () => {
    const html = renderToStaticMarkup(<MimsAdvisoryCard />);
    expect(html).toContain("Not evaluated");
    expect(html).toContain("No validated Make It Make Sense assessment");
    expect(html).toContain("Do not treat workflow verification as factual");
    expect(html).not.toContain("— PASS");
  });

  it("displays seven dimensions, a REVIEW verdict and an explicit non-truth boundary", () => {
    const html = renderToStaticMarkup(<MimsAdvisoryCard assessment={preliminary()} />);
    expect(html).toContain("Make It Make Sense — REVIEW");
    for (const term of ["Evidence", "Chronology", "Causal logic", "Incentives", "Base rates", "Contradictions", "Alternatives"]) {
      expect(html).toContain(term + ":");
    }
    expect(html).toContain("not an independent fact-check");
    expect(html).toContain("Coherence does not establish truth");
    expect(html).toContain("advisory only");
  });

  it("does not display a forged authority or bogus fact check as a valid verdict", () => {
    const receipt = preliminary();
    const untrusted = {
      ...receipt,
      authority: "EXECUTE",
      vote: { ...receipt.vote, status: "PASS" },
    } as unknown as AskMakeItMakeSenseReceipt;
    const html = renderToStaticMarkup(<MimsAdvisoryCard assessment={untrusted} />);
    expect(html).toContain("Not evaluated");
    expect(html).not.toContain("— PASS");
  });
});
