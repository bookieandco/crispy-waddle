import type { CanonicalHomeStateEvent } from './home-assistant-state-events.js';
import type { DecisionProposal } from '@jhadina/core-spine';

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

/** Pure evaluator: matching can propose an action, but never executes it. */
export function evaluateHomeAutomationRule(
  rule: HomeAutomationRule,
  event: CanonicalHomeStateEvent,
): HomeAutomationEvaluation {
  if (!rule.enabled || rule.version < 1) return { ruleId: rule.id, matched: false };
  const matched = event.entityId === rule.when.entityId && event.state === rule.when.state;
  if (!matched) return { ruleId: rule.id, matched: false };

  const proposal: DecisionProposal = {
    id: `automation:${rule.id}:${event.id}`,
    reason: `Home automation rule ${rule.id} matched`,
    action: rule.then.capability,
    parameters: {
      operation: rule.then.operation,
      ...rule.then.input,
    },
    consequenceLevel: rule.then.consequenceLevel,
  };

  return { ruleId: rule.id, matched: true, proposal };
}
