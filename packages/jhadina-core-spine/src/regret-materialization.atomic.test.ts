import { describe, expect, it } from 'vitest';
import type { EvidenceRef } from './types.js';
import type { RegretAssessmentInput } from './regret-assessment.js';
import { assessRegret } from './regret-assessment.js';
import { materializeRegretAssessmentWithMemory } from './regret-materialization.js';
import type { RegretMemory, RegretMemoryRecord } from './regret-memory.js';

const evidence: EvidenceRef = Object.freeze({
  id: 'evidence-1',
  source: 'test',
  observedAt: '2026-09-12T00:00:00.000Z',
  summary: 'Verified outcome evidence',
  immutable: true,
});

function source(userId: string, rootCause = 'missed-check'): RegretAssessmentInput {
  void userId;
  return {
    subjectType: 'decision',
    subjectId: `decision-${rootCause}`,
    originalBelief: 'Expected success',
    expectedOutcome: 'Success',
    actualOutcome: 'Failure',
    outcomeEvidence: [evidence],
    discrepancy: 'Expected success but observed failure',
    severity: 'R3',
    avoidability: 'high',
    couldHaveKnown: true,
    couldHaveActedDifferently: true,
    alternativeLikelyImprovedOutcome: true,
    rootCause,
  };
}

function memory(records: RegretMemoryRecord[] = []): RegretMemory {
  return {
    append: () => { throw new Error('not used'); },
    get: () => undefined,
    retrieve: () => [],
    listRelated: () => [],
    findRecurrences: (_userId, rootCause) => records.filter(
      (record) => record.regret.rootCause === rootCause &&
        (record.regret.status === 'verified' || record.regret.status === 'learned'),
    ),
    supersede: () => { throw new Error('not used'); },
    getProvenance: () => [],
    evaluateRecall: () => ({ recallAtK: 0, relevantCount: 0, returnedRelevantCount: 0 }),
  };
}

describe('authoritative regret materialization', () => {
  it('derives recurrence from verified history rather than caller input', async () => {
    const assessment = assessRegret(source('user-a'));
    const history = [
      {
        memoryId: 'm1', userId: 'user-a', createdAt: '2026-09-10T00:00:00.000Z',
        regret: {
          regretId: 'r1', subjectType: 'decision', subjectId: 'd1', createdAt: '2026-09-10T00:00:00.000Z',
          originalBelief: 'x', expectedOutcome: 'x', actualOutcome: 'y', outcomeEvidence: [evidence],
          discrepancy: 'x', severity: 'R3', avoidability: 'high', rootCause: 'missed-check', recurrenceCount: 99, status: 'verified',
        }, provenance: [evidence], tags: [], salience: 0.5,
      } as unknown as RegretMemoryRecord,
    ];

    const result = await materializeRegretAssessmentWithMemory({
      assessment, source: source('user-a'), regretId: 'r2', createdAt: '2026-09-12T00:00:00.000Z',
      userId: 'user-a', memory: memory(history),
    });

    expect(result?.recurrenceCount).toBe(2);
  });

  it('isolates recurrence by user through the memory boundary', async () => {
    const assessment = assessRegret(source('user-b'));
    const history = [{
      memoryId: 'm1', userId: 'user-a', createdAt: '2026-09-10T00:00:00.000Z',
      regret: { rootCause: 'missed-check', status: 'verified', severity: 'R3', avoidability: 'high' },
      provenance: [evidence], tags: [], salience: 0.5,
    } as unknown as RegretMemoryRecord];

    const result = await materializeRegretAssessmentWithMemory({
      assessment, source: source('user-b'), regretId: 'r3', createdAt: '2026-09-12T00:00:00.000Z',
      userId: 'user-b', memory: memory(history),
    });

    expect(result?.recurrenceCount).toBe(2);
  });

  it('does not create a regret without verified outcome evidence', async () => {
    const invalid = source('user-a');
    const assessment = assessRegret({ ...invalid, outcomeEvidence: [] });
    const result = await materializeRegretAssessmentWithMemory({
      assessment, source: { ...invalid, outcomeEvidence: [] }, regretId: 'r4',
      createdAt: '2026-09-12T00:00:00.000Z', userId: 'user-a', memory: memory(),
    });
    expect(result).toBeNull();
  });
});
