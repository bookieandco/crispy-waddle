import {
  bindMakeItMakeSenseStage,
  makeItMakeSense,
  type ContextPacket,
  type DecisionProposal,
  type MakeItMakeSenseCheck,
  type StagedMakeItMakeSenseVote,
} from '@jhadina/core-spine';
import { collectContextEvidence } from './evidence-binding.js';

export type AskMakeItMakeSenseReceipt = StagedMakeItMakeSenseVote<'ASK_JHADINA'> & Readonly<{
  assessmentScope: 'PRELIMINARY_EVIDENCE_DISCIPLINE';
  independentFactCheckPerformed: false;
}>;

/**
 * Conservative per-proposal MIMS readout. This is NOT an automated fact-check.
 * The existing universal evaluator is reused and stays advisory-only.
 *
 * Context-bound evidence IDs demonstrate provenance, not truth or relevance.
 * An LLM recommendation/rationale/alternative is NEVER counted as independent
 * corroboration. Unexamined dimensions remain REVIEW, never PASS by default.
 */
export function assessAskMakeItMakeSense(
  context: ContextPacket,
  proposal: DecisionProposal,
): AskMakeItMakeSenseReceipt {
  // A mismatched provider context is a REVIEW with no admitted evidence;
  // do not throw away the already-governed decision or label it verified.
  const contextBound = proposal.contextId === context.id;
  const allowed = new Set(collectContextEvidence(context).map((evidence) => evidence.id));
  const acceptedRefs = contextBound
    ? [...new Set(proposal.evidence.map((ref) => ref.id).filter((id) => allowed.has(id)))].slice(0, 20)
    : [];
  const rejectedCount = proposal.evidence.filter((ref) => !allowed.has(ref.id)).length;
  const checks: MakeItMakeSenseCheck[] = [
    {
      dimension: 'EVIDENCE',
      status: 'REVIEW',
      rationale: !contextBound
        ? 'Proposal context does not match this request; no evidence was admitted and independent verification remains outstanding.'
        : acceptedRefs.length
          ? `${acceptedRefs.length} context-bound evidence reference(s) found; independently validating their support for this conclusion remains outstanding.`
          : 'No context-bound evidence is cited for this conclusion; independent factual verification is outstanding.',
      evidenceRefs: acceptedRefs,
    },
    {
      dimension: 'CHRONOLOGY',
      status: 'REVIEW',
      rationale: 'No independently verified event timeline or temporal ordering check has run.',
      evidenceRefs: [],
    },
    {
      dimension: 'CAUSAL_LOGIC',
      status: 'REVIEW',
      rationale: 'The explanation may be internally coherent, but causal premises have not been independently tested.',
      evidenceRefs: [],
    },
    {
      dimension: 'INCENTIVES',
      status: 'REVIEW',
      rationale: 'Incentives and strategic motives have not been separately validated against reliable sources.',
      evidenceRefs: [],
    },
    {
      dimension: 'BASE_RATES',
      status: 'REVIEW',
      rationale: 'No grounded base-rate denominator or prior-frequency comparison is available in this assessment.',
      evidenceRefs: [],
    },
    {
      dimension: 'CONTRADICTIONS',
      status: 'REVIEW',
      rationale: context.domainContext?.spatial?.conflicts.length
        ? `${context.domainContext.spatial.conflicts.length} spatial-context conflict(s) are reported; independent adjudication remains outstanding.`
        : 'A systematic contradiction and competing-evidence search has not been performed.',
      evidenceRefs: [],
    },
    {
      dimension: 'ALTERNATIVES',
      status: 'REVIEW',
      rationale: proposal.alternatives.length
        ? `${proposal.alternatives.length} alternative(s) suggested by the model; none have been independently compared or verified.`
        : 'No independent assessment of alternative explanations or hypotheses has been performed.',
      evidenceRefs: [],
    },
  ];
  if (rejectedCount > 0) {
    checks[0] = {
      ...checks[0]!,
      rationale: `${checks[0]!.rationale} ${rejectedCount} unknown evidence reference(s) were excluded.`,
    };
  }
  const vote = makeItMakeSense({
    voteId: `ask-mims:${proposal.id}`,
    subjectId: context.id,
    checks,
  });
  const staged = bindMakeItMakeSenseStage({
    stage: 'ASK_JHADINA',
    vote,
    expectedSubjectId: context.id,
  });
  return Object.freeze({
    ...staged,
    assessmentScope: 'PRELIMINARY_EVIDENCE_DISCIPLINE' as const,
    independentFactCheckPerformed: false as const,
  });
}
