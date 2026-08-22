import type { DecisionDisposition, DecisionProposal, EvidenceRef } from '@jhadina/core-spine';

/**
 * The actual anti-bypass boundary for anything a model provider returns.
 *
 * A model's raw output is untrusted input, no different from a request
 * body from the network. This parser reads it field-by-field into
 * exactly `DecisionProposal`'s known shape — it never spreads the parsed
 * JSON, never passes through unrecognized keys, and never trusts an `id`
 * the model supplied. A provider cannot smuggle extra authority (an
 * invented `capability`, `approved`, `executeNow`, or `policyOverride`
 * field, or a disposition value outside the four defined here) through
 * this boundary, because nothing downstream of this function ever sees
 * whatever field name the model chose to use for that attempt — the
 * object returned from `parseDecisionProposal` has exactly the properties
 * this file writes onto it and no others.
 */

export class InvalidModelProposalError extends Error {
  constructor(reason: string) {
    super(`INVALID_MODEL_PROPOSAL:${reason}`);
    this.name = 'InvalidModelProposalError';
  }
}

const VALID_DISPOSITIONS: readonly DecisionDisposition[] = ['PROCEED', 'ASK', 'DECLINE', 'DEFER'];

function isValidDisposition(value: unknown): value is DecisionDisposition {
  return typeof value === 'string' && (VALID_DISPOSITIONS as readonly string[]).includes(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function toEvidenceRefArray(value: unknown, observedAt: string): EvidenceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry, index) => ({
      id: typeof entry.id === 'string' ? entry.id : `evidence-${index}`,
      source: typeof entry.source === 'string' ? entry.source : 'model-proposal',
      observedAt,
      summary: typeof entry.summary === 'string' ? entry.summary : '',
    }));
}

/**
 * Parses one JSON object out of a model's raw text response and validates
 * it into a `DecisionProposal`. Throws `InvalidModelProposalError` on
 * anything that doesn't satisfy the required shape — including a
 * technically-valid JSON object missing `disposition`/`recommendation`/
 * `rationale`, or a `disposition` value the model invented. A thrown
 * error here is a normal, expected outcome: `IntelligenceRouter` treats it
 * exactly like any other provider failure and falls back.
 */
export function parseDecisionProposal(rawText: string, contextId: string): DecisionProposal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(rawText));
  } catch {
    throw new InvalidModelProposalError('response_not_valid_json');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidModelProposalError('response_not_an_object');
  }

  const candidate = parsed as Record<string, unknown>;

  if (!isValidDisposition(candidate.disposition)) {
    throw new InvalidModelProposalError('missing_or_invalid_disposition');
  }
  if (typeof candidate.recommendation !== 'string' || candidate.recommendation.trim() === '') {
    throw new InvalidModelProposalError('missing_recommendation');
  }
  if (typeof candidate.rationale !== 'string' || candidate.rationale.trim() === '') {
    throw new InvalidModelProposalError('missing_rationale');
  }

  const observedAt = new Date().toISOString();

  // Field-by-field construction, not a spread of `candidate` — this is
  // the line that actually enforces the header comment above.
  const proposal: DecisionProposal = {
    id: `proposal_${contextId}_${crypto.randomUUID()}`,
    contextId,
    disposition: candidate.disposition,
    recommendation: candidate.recommendation,
    rationale: candidate.rationale,
    evidence: toEvidenceRefArray(candidate.evidence, observedAt),
    uncertainty: toStringArray(candidate.uncertainty),
    alternatives: toStringArray(candidate.alternatives),
  };

  return proposal;
}

/**
 * Models are frequently asked for "JSON only" and still wrap it in prose
 * or a markdown code fence. Extracts the first top-level `{...}` object
 * rather than assuming the entire response is bare JSON. Does not itself
 * validate the contents — `JSON.parse` and the checks above still run on
 * whatever this returns.
 */
function extractJsonObject(rawText: string): string {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new InvalidModelProposalError('no_json_object_found');
  }
  return rawText.slice(start, end + 1);
}
