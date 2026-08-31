import type { CanonicalHomeStateEvent } from './home-assistant-state-events.js';
import type { DecisionProposal, EvidenceRef } from '@jhadina/core-spine';

export type HomeAutomationCondition = Readonly<{
  entityId: string;
  state: string | number | boolean | null;
}>;

export type HomeAutomationAction = Readonly<{
  capability: string;
  operation: string;
  input: Readonly<Record<string, unknown>>;
  reversible: boolean;
  consequenceLevel: 'low' | 'medium' | 'high';
}>;

export interface HomeAutomationRule {
  readonly id: string;
  readonly version: number;
  readonly enabled: boolean;
  readonly when: HomeAutomationCondition;
  readonly then: HomeAutomationAction;
}

export interface HomeAutomationEvaluation {
  readonly ruleId: string;
  readonly matched: boolean;
  readonly proposal?: DecisionProposal;
}

function eventEvidence(event: CanonicalHomeStateEvent): EvidenceRef {
  return {
    id: event.id,
    source: event.provenance.source,
    observedAt: event.occurredAt,
    summary: `${event.entityId} changed from ${String(event.previousState)} to ${String(event.state)}`,
  };
}

/** Pure evaluator: matching can propose a decision, but never executes it. */
export function evaluateHomeAutomationRule(
  rule: HomeAutomationRule,
  event: CanonicalHomeStateEvent,
): HomeAutomationEvaluation {
  if (!rule.enabled || rule.version < 1) return { ruleId: rule.id, matched: false };
  const matched = event.entityId === rule.when.entityId && event.state === rule.when.state;
  if (!matched) return { ruleId: rule.id, matched: false };

  const proposal: DecisionProposal = {
    id: `automation:${rule.id}:${event.id}`,
    contextId: `home-automation:${rule.id}`,
    disposition: 'PROCEED',
    recommendation: `Execute ${rule.then.operation} through capability ${rule.then.capability}`,
    rationale: `Deterministic home automation rule ${rule.id} matched ${event.entityId}=${String(event.state)}`,
    evidence: [eventEvidence(event)],
    uncertainty: [],
    alternatives: [],
  };

  return { ruleId: rule.id, matched: true, proposal };
}
