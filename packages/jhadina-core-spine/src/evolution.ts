import type { EvidenceRef } from './types.js';

export type ImprovementSource =
  | 'user_message'
  | 'chatgpt'
  | 'claude'
  | 'copilot'
  | 'repository'
  | 'runtime'
  | 'observation';

export type ImprovementKind =
  | 'capability'
  | 'workflow'
  | 'personality'
  | 'knowledge'
  | 'performance'
  | 'ux'
  | 'safety'
  | 'integration';

export type ImprovementStatus =
  | 'proposed'
  | 'analyzing'
  | 'experiment'
  | 'awaiting_approval'
  | 'rejected'
  | 'promoted'
  | 'retired';

/**
 * A piece of external work or an idea that Jhadina is asked to understand.
 * The source is evidence, not authority: importing something never grants it
 * permission to change Jhadina.
 */
export interface ImprovementInput {
  id: string;
  source: ImprovementSource;
  title?: string;
  content: string;
  referencedArtifacts?: Array<{
    kind: 'repository' | 'file' | 'url' | 'conversation' | 'spec';
    reference: string;
  }>;
  receivedAt: string;
  evidence: EvidenceRef[];
}

export interface ImprovementProposal {
  id: string;
  inputId: string;
  kind: ImprovementKind;
  title: string;
  problem: string;
  proposedChange: string;
  rationale: string;
  expectedBenefit: string;
  risks: string[];
  dependencies: string[];
  affectedDomains: string[];
  evidence: EvidenceRef[];
  confidence: number;
  reversible: boolean;
  requiresApproval: boolean;
  status: ImprovementStatus;
}

export interface ImprovementEvaluation {
  id: string;
  proposalId: string;
  tests: Array<{
    name: string;
    passed: boolean;
    evidence?: EvidenceRef[];
  }>;
  regressions: string[];
  recommendation: 'promote' | 'revise' | 'reject';
  evaluatedAt: string;
}

export interface EvolutionPort {
  analyze(input: ImprovementInput): Promise<ImprovementProposal>;
  evaluate(proposal: ImprovementProposal): Promise<ImprovementEvaluation>;
  promote(proposal: ImprovementProposal, evaluation: ImprovementEvaluation): Promise<void>;
}

/**
 * The safe self-improvement boundary: Jhadina may inspect external ideas,
 * code, conversations, and systems, then formulate a governed proposal.
 * Promotion remains an explicit policy-controlled operation.
 */
export interface SelfImprovementPort {
  intake(input: ImprovementInput): Promise<ImprovementProposal>;
}
