import type { ActionProposal, AgentDefinition, AuthorizationContext, WorkflowRun } from "./types.js";

export type DispatcherRecommendation = "accept" | "counter" | "decline";

export interface DispatcherCandidateSummary {
  loadId: string;
  recommendation: DispatcherRecommendation;
  score: number;
}

export interface DispatcherAnalysisContext {
  carrierId: string;
  driverId: string;
  topCandidate: DispatcherCandidateSummary | null;
  candidates: readonly DispatcherCandidateSummary[];
  analysisVersion: string;
}

export interface DispatcherAgentOptions {
  agent: AgentDefinition;
  bookingToolId: string;
  capabilityId?: string;
  proposalTtlMs?: number;
}

/**
 * Converts deterministic Dispatcher output into boundary proposals.
 *
 * The adapter deliberately does not import DispatcherService. The economics
 * engine remains the source of truth and this package only consumes its
 * normalized result. A qualifying load becomes a booking proposal that the
 * policy layer must hold for approval.
 */
export function createDispatcherAnalysisReasoner(options: DispatcherAgentOptions) {
  const capabilityId = options.capabilityId ?? "dispatcher.booking";
  const ttlMs = options.proposalTtlMs ?? 15 * 60 * 1000;

  return {
    async reason(context: DispatcherAnalysisContext, run: WorkflowRun): Promise<readonly ActionProposal[]> {
      const top = context.topCandidate;
      if (!top || top.recommendation === "decline") return [];

      const authorizationContext: AuthorizationContext = {
        actorId: context.driverId,
        carrierId: context.carrierId,
        driverId: context.driverId,
        resourceId: top.loadId,
        capabilityId,
        approvalRequired: true,
      };

      return [{
        id: `${run.id}:dispatcher-booking:${top.loadId}`,
        workflowRunId: run.id,
        agentId: options.agent.id,
        agentVersion: options.agent.version,
        toolId: options.bookingToolId,
        input: {
          loadId: top.loadId,
          recommendation: top.recommendation,
          score: top.score,
          analysisVersion: context.analysisVersion,
          candidateCount: context.candidates.length,
        },
        authorizationContext,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      }];
    },
  };
}
