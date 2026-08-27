import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { OpportunityFit } from './brand-audience.js';

export type GrowthAction = 'observe' | 'recommend' | 'create' | 'approve' | 'publish' | 'measure' | 'learn';
export type GrowthActionStatus = 'queued' | 'blocked' | 'ready' | 'completed' | 'dismissed';

export interface GrowthCommand {
  id: GrowthId;
  brandId: GrowthId;
  opportunityId: GrowthId;
  action: GrowthAction;
  status: GrowthActionStatus;
  priority: number;
  title: string;
  rationale: string;
  requiresApproval: boolean;
  createdAt: ISODateTime;
}

export interface CommandQueuePolicy {
  minimumFitScore?: number;
  minimumOpportunityScore?: number;
  requireApprovalFor?: readonly GrowthAction[];
}

const DEFAULT_POLICY: Required<CommandQueuePolicy> = { minimumFitScore: 60, minimumOpportunityScore: 60, requireApprovalFor: ['publish'] };

export function opportunityToGrowthCommand(fit: OpportunityFit, brandId: GrowthId, createdAt: ISODateTime, policy: CommandQueuePolicy = DEFAULT_POLICY): GrowthCommand | null {
  const minimumFit = policy.minimumFitScore ?? DEFAULT_POLICY.minimumFitScore;
  const minimumOpportunity = policy.minimumOpportunityScore ?? DEFAULT_POLICY.minimumOpportunityScore;
  if (!fit.recommended || fit.fitScore < minimumFit || fit.opportunity.score < minimumOpportunity) return null;
  const action: GrowthAction = fit.opportunity.recommendedAction === 'listen' ? 'observe' : 'create';
  const requiresApproval = (policy.requireApprovalFor ?? DEFAULT_POLICY.requireApprovalFor).includes(action);
  return {
    id: `growth-command:${brandId}:${fit.opportunity.id}`,
    brandId,
    opportunityId: fit.opportunity.id,
    action,
    status: requiresApproval ? 'blocked' : 'ready',
    priority: Math.round((fit.fitScore + fit.opportunity.score) * 100) / 100,
    title: `${action.toUpperCase()}: ${fit.opportunity.title}`,
    rationale: fit.matchedSignals.length ? `Matched: ${fit.matchedSignals.join(', ')}` : fit.opportunity.rationale,
    requiresApproval,
    createdAt,
  };
}

export function buildGrowthCommandQueue(brandId: GrowthId, fits: readonly OpportunityFit[], createdAt: ISODateTime, policy: CommandQueuePolicy = DEFAULT_POLICY): GrowthCommand[] {
  return fits.map((fit) => opportunityToGrowthCommand(fit, brandId, createdAt, policy)).filter((command): command is GrowthCommand => command !== null).sort((a, b) => b.priority - a.priority);
}
