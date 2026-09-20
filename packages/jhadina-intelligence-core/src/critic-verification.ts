import type { DecisionProposal } from '@jhadina/core-spine';
import type { CompiledIntelligenceContext, IntelligenceProposalVerifier } from './intelligence-fabric.js';
import type { ClassifiedIntelligenceTask } from './task-classifier.js';

export interface ProposalCritique {
  readonly accepted: boolean;
  readonly issues: readonly string[];
  readonly uncertainty: readonly string[];
}

export interface ProposalCritic {
  critique(input: {
    readonly proposal: DecisionProposal;
    readonly context: CompiledIntelligenceContext;
  }): Promise<ProposalCritique>;
}

export interface CriticVerificationPipelineOptions {
  readonly evidenceVerifier: IntelligenceProposalVerifier;
  readonly critic?: ProposalCritic;
  readonly requireCritic?: (context: CompiledIntelligenceContext) => boolean;
}

/**
 * Cognitive quality gate only. Criticism can downgrade a proposal to DEFER,
 * but can never upgrade disposition, grant authority, or execute anything.
 * Evidence verification always runs after criticism.
 */
export class CriticVerificationPipeline implements IntelligenceProposalVerifier {
  constructor(private readonly options: CriticVerificationPipelineOptions) {}

  async verify(proposal: DecisionProposal, context: CompiledIntelligenceContext): Promise<DecisionProposal> {
    const needsCritic = this.options.requireCritic?.(context) ?? defaultNeedsCritic(context);
    let reviewed = proposal;

    if (needsCritic) {
      if (!this.options.critic) throw new CriticUnavailableError(context.task.id);
      const critique = await this.options.critic.critique({ proposal, context });
      if (!critique.accepted) {
        reviewed = Object.freeze({
          ...proposal,
          disposition: 'DEFER',
          uncertainty: Object.freeze([
            ...proposal.uncertainty,
            ...critique.uncertainty,
            ...critique.issues.map((issue) => `Critic: ${issue}`),
          ]),
        });
      } else if (critique.uncertainty.length) {
        reviewed = Object.freeze({
          ...proposal,
          uncertainty: Object.freeze([...proposal.uncertainty, ...critique.uncertainty]),
        });
      }
    }

    return this.options.evidenceVerifier.verify(reviewed, context);
  }
}

export class CriticUnavailableError extends Error {
  constructor(public readonly taskId: string) {
    super(`CRITIC_REQUIRED_BUT_UNAVAILABLE:${taskId}`);
    this.name = 'CriticUnavailableError';
  }
}

function defaultNeedsCritic(context: CompiledIntelligenceContext): boolean {
  if (context.task.riskClass === 'high' || context.task.riskClass === 'critical') return true;
  const task = context.task as Partial<ClassifiedIntelligenceTask>;
  return task.complexity === 'complex' || task.complexity === 'deep';
}
