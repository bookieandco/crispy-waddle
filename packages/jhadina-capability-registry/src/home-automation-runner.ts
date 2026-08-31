import type { DomainEvent } from '@jhadina/event-bus';
import type { CanonicalHomeStateEvent } from './home-assistant-state-events.js';
import { evaluateHomeAutomationRule, type HomeAutomationEvaluation, type HomeAutomationRule } from './home-automation-rules.js';

export interface HomeAutomationProposalSink {
  propose(evaluation: HomeAutomationEvaluation): void | Promise<void>;
}

/** Event-driven rule runner. It evaluates rules and emits proposals; it never executes actions. */
export class HomeAutomationRunner {
  constructor(
    private readonly rules: readonly HomeAutomationRule[],
    private readonly sink: HomeAutomationProposalSink,
  ) {}

  async handle(event: DomainEvent<CanonicalHomeStateEvent>): Promise<void> {
    if (event.type !== 'home.entity.state_changed') return;
    for (const rule of this.rules) {
      const evaluation = evaluateHomeAutomationRule(rule, event.payload);
      if (evaluation.matched) await this.sink.propose(evaluation);
    }
  }
}
