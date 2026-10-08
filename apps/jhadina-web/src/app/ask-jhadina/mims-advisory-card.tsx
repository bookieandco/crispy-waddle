import * as React from "react";
import type { AskMakeItMakeSenseReceipt } from "@jhadina/intelligence-core";

const dimensionLabels: Record<
  AskMakeItMakeSenseReceipt["vote"]["checks"][number]["dimension"],
  string
> = {
  EVIDENCE: "Evidence",
  CHRONOLOGY: "Chronology",
  CAUSAL_LOGIC: "Causal logic",
  INCENTIVES: "Incentives",
  BASE_RATES: "Base rates",
  CONTRADICTIONS: "Contradictions",
  ALTERNATIVES: "Alternatives",
};

/**
 * Present MIMS on the phone without conflating workflow verification with
 * factual certainty. Specialist shortcuts that do not run the general Ask
 * evaluator have no vote: never synthesize a PASS or imply fact-checking.
 */
export function MimsAdvisoryCard({
  assessment,
}: {
  assessment?: AskMakeItMakeSenseReceipt;
}) {
  const safeVote =
    assessment?.authority === "ADVISORY_ONLY" &&
    assessment?.vote.authority === "ADVISORY_ONLY" &&
    assessment?.canAuthorizeAction === false &&
    assessment?.independentFactCheckPerformed === false &&
    assessment?.vote.independentValidationStillRequired === true &&
    assessment?.vote.coherentNotEquivalentToTrue === true
      ? assessment.vote
      : undefined;

  return (
    <details className="jh-item" style={{ marginTop: 16 }}>
      <summary style={{ cursor: "pointer" }}>
        <strong>Make It Make Sense — {safeVote?.status ?? "Not evaluated"}</strong>
      </summary>
      {safeVote ? (
        <>
          <p className="jh-card-copy">
            Preliminary reasoning and evidence review only. It is not an
            independent fact-check, proof of truth, or authorization to act.
          </p>
          <ul>
            {safeVote.checks.map((check) => (
              <li key={check.dimension} className="jh-card-copy">
                <strong>{dimensionLabels[check.dimension]}: {check.status}</strong>
                {" — "}{check.rationale}
              </li>
            ))}
          </ul>
          <p className="jh-meta">
            Coherence does not establish truth. Independent verification is
            still required. This assessment is advisory only.
          </p>
        </>
      ) : (
        <p className="jh-card-copy">
          No validated Make It Make Sense assessment was returned on this
          response path. Do not treat workflow verification as factual
          verification.
        </p>
      )}
    </details>
  );
}
