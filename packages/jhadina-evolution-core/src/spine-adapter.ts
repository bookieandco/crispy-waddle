import type {
  EvolutionPort,
  ImprovementEvaluation,
  ImprovementInput,
  ImprovementProposal,
} from '@jhadina/core-spine';

export interface EvolutionAnalyzer {
  analyze(input: ImprovementInput): Promise<ImprovementProposal>;
}

export interface EvolutionEvaluator {
  evaluate(proposal: ImprovementProposal): Promise<ImprovementEvaluation>;
}

export interface EvolutionPromoter {
  promote(
    proposal: ImprovementProposal,
    evaluation: ImprovementEvaluation,
  ): Promise<void>;
}

/**
 * Adapter from the Core Spine's stable EvolutionPort to the concrete
 * evolution implementation. The adapter intentionally contains no policy
 * bypass: promotion is delegated to a governed promoter.
 */
export class JhadinaEvolutionAdapter implements EvolutionPort {
  constructor(
    private readonly analyzer: EvolutionAnalyzer,
    private readonly evaluator: EvolutionEvaluator,
    private readonly promoter: EvolutionPromoter,
  ) {}

  analyze(input: ImprovementInput): Promise<ImprovementProposal> {
    return this.analyzer.analyze(input);
  }

  evaluate(proposal: ImprovementProposal): Promise<ImprovementEvaluation> {
    return this.evaluator.evaluate(proposal);
  }

  async promote(
    proposal: ImprovementProposal,
    evaluation: ImprovementEvaluation,
  ): Promise<void> {
    if (evaluation.proposalId !== proposal.id) {
      throw new Error(
        `Evolution evaluation ${evaluation.id} does not belong to proposal ${proposal.id}`,
      );
    }

    if (evaluation.recommendation !== 'promote') {
      throw new Error(
        `Evolution proposal ${proposal.id} cannot be promoted after recommendation ${evaluation.recommendation}`,
      );
    }

    if (!proposal.reversible) {
      throw new Error(
        `Evolution proposal ${proposal.id} is not reversible and requires explicit governed promotion handling`,
      );
    }

    await this.promoter.promote(proposal, evaluation);
  }
}
