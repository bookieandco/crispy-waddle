import { describe, expect, it } from 'vitest';
import {
  assertResearchEvidence,
  validateResearchEvidence,
  type ResearchEvidenceEnvelope,
} from './research-evidence.js';

const hash = `sha256:${'a'.repeat(64)}`;

function fixture(): ResearchEvidenceEnvelope {
  return {
    id: 'research-1',
    subsystemOwner: 'shark',
    researchQuestion: 'What does the evidence establish?',
    observedAt: '2026-10-04T04:00:00.000Z',
    sources: [
      {
        id: 'source-1',
        url: 'https://example.com/evidence',
        observedAt: '2026-10-04T03:59:00.000Z',
        contentHash: hash,
        sourceType: 'web',
      },
    ],
    claims: [
      {
        id: 'claim-1',
        statement: 'The source supports the bounded claim.',
        sourceIds: ['source-1'],
        confidence: 0.8,
        status: 'supported',
      },
    ],
    contradictions: [],
    alternativeExplanations: [],
    makeItMakeSense: {
      verdict: 'coherent',
      rationale: 'Chronology, evidence and the bounded claim are mutually consistent.',
    },
    authority: 'EVIDENCE_ONLY',
  };
}

describe('research evidence envelope', () => {
  it('admits evidence with provenance and evidence-only authority', () => {
    expect(validateResearchEvidence(fixture())).toEqual({ valid: true, reasons: [] });
    expect(() => assertResearchEvidence(fixture())).not.toThrow();
  });

  it('refuses a supported claim without a source', () => {
    const value = fixture();
    value.claims[0] = { ...value.claims[0]!, sourceIds: [] };
    expect(validateResearchEvidence(value).reasons).toContain(
      'RESEARCH_SUPPORTED_CLAIM_SOURCE_REQUIRED:claim-1',
    );
  });

  it('refuses unknown claim source lineage', () => {
    const value = fixture();
    value.claims[0] = { ...value.claims[0]!, sourceIds: ['missing'] };
    expect(validateResearchEvidence(value).reasons).toContain(
      'RESEARCH_CLAIM_SOURCE_UNKNOWN:claim-1:missing',
    );
  });

  it('requires content-addressed source evidence', () => {
    const value = fixture();
    value.sources[0] = { ...value.sources[0]!, contentHash: 'not-a-hash' };
    expect(validateResearchEvidence(value).reasons).toContain(
      'RESEARCH_SOURCE_HASH_INVALID:source-1',
    );
  });

  it('does not admit research as execution authority', () => {
    const value = {
      ...fixture(),
      authority: 'EXECUTE',
    } as unknown as ResearchEvidenceEnvelope;
    expect(validateResearchEvidence(value).reasons).toContain(
      'RESEARCH_AUTHORITY_MUST_BE_EVIDENCE_ONLY',
    );
  });

  it('requires an explicit make-it-make-sense rationale', () => {
    const value = fixture();
    value.makeItMakeSense = { ...value.makeItMakeSense, rationale: '' };
    expect(() => assertResearchEvidence(value)).toThrow(
      'RESEARCH_EVIDENCE_INVALID:RESEARCH_MAKE_IT_MAKE_SENSE_RATIONALE_REQUIRED',
    );
  });
});
