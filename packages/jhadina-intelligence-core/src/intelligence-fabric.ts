import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import type { ModelProvider } from './router.js';

/**
 * Canonical contract for Jhadina's intelligence fabric.
 *
 * The fabric owns cognitive preparation and inference only. It never grants
 * capabilities, approves actions, executes tools, mutates policy, or commits
 * durable memory. Its terminal product is always a DecisionProposal for the
 * existing Core Spine governance path.
 */
export type IntelligenceModality = 'text' | 'vision' | 'audio' | 'video' | 'code';
export type IntelligenceCapability =
  | 'reason'
  | 'research'
  | 'summarize'
  | 'classify'
  | 'extract'
  | 'plan'
  | 'critique'
  | 'verify';

export type IntelligenceRiskClass = 'low' | 'standard' | 'high' | 'critical';
export type IntelligencePrivacyClass = 'public' | 'internal' | 'sensitive' | 'restricted';

export interface IntelligenceTask {
  readonly id: string;
  readonly purpose: string;
  readonly modalities: readonly IntelligenceModality[];
  readonly requiredCapabilities: readonly IntelligenceCapability[];
  readonly riskClass: IntelligenceRiskClass;
  readonly privacyClass: IntelligencePrivacyClass;
}

export interface CompiledIntelligenceContext {
  readonly task: IntelligenceTask;
  readonly packet: ContextPacket;
  /** Immutable evidence identifiers resolved before inference. */
  readonly evidenceIds: readonly string[];
  /** Stable digest of the exact governed context sent for inference. */
  readonly contextHash: string;
}

export interface IntelligenceRoute {
  readonly provider: ModelProvider;
  readonly reason: string;
  readonly fallbackProviders: readonly ModelProvider[];
}

export interface IntelligenceRouteSelector {
  select(task: IntelligenceTask, context: CompiledIntelligenceContext): Promise<IntelligenceRoute>;
}

export interface IntelligenceContextCompiler {
  compile(task: IntelligenceTask, packet: ContextPacket): Promise<CompiledIntelligenceContext>;
}

export interface IntelligenceProposalVerifier {
  verify(proposal: DecisionProposal, context: CompiledIntelligenceContext): Promise<DecisionProposal>;
}

export interface InferenceRecord {
  readonly inferenceId: string;
  readonly taskId: string;
  readonly contextHash: string;
  readonly provider: string;
  readonly routeReason: string;
  readonly evidenceIds: readonly string[];
  readonly outcome: 'succeeded' | 'failed';
  readonly proposalId?: string;
  readonly errorCode?: string;
  readonly observedAt: string;
}

export interface IntelligenceInferenceLedger {
  append(record: InferenceRecord): Promise<void>;
}

export interface IntelligenceFabricDeps {
  contextCompiler: IntelligenceContextCompiler;
  routeSelector: IntelligenceRouteSelector;
  proposalVerifier: IntelligenceProposalVerifier;
  ledger: IntelligenceInferenceLedger;
  now?: () => string;
  newId?: () => string;
}

export class IntelligenceFabric {
  constructor(private readonly deps: IntelligenceFabricDeps) {}

  async decide(task: IntelligenceTask, packet: ContextPacket): Promise<DecisionProposal> {
    const context = await this.deps.contextCompiler.compile(task, packet);
    const route = await this.deps.routeSelector.select(task, context);
    const providers = [route.provider, ...route.fallbackProviders];
    let lastError: unknown;

    for (const provider of providers) {
      const inferenceId = this.deps.newId?.() ?? crypto.randomUUID();
      try {
        const proposal = await provider.propose(context.packet);
        const verified = await this.deps.proposalVerifier.verify(proposal, context);
        await this.deps.ledger.append({
          inferenceId,
          taskId: task.id,
          contextHash: context.contextHash,
          provider: provider.name,
          routeReason: route.reason,
          evidenceIds: context.evidenceIds,
          outcome: 'succeeded',
          proposalId: verified.id,
          observedAt: this.deps.now?.() ?? new Date().toISOString(),
        });
        return verified;
      } catch (error) {
        lastError = error;
        await this.deps.ledger.append({
          inferenceId,
          taskId: task.id,
          contextHash: context.contextHash,
          provider: provider.name,
          routeReason: route.reason,
          evidenceIds: context.evidenceIds,
          outcome: 'failed',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_INFERENCE_FAILURE',
          observedAt: this.deps.now?.() ?? new Date().toISOString(),
        });
      }
    }

    throw new IntelligenceFabricUnavailableError(lastError);
  }
}

export class IntelligenceFabricUnavailableError extends Error {
  constructor(public readonly cause: unknown) {
    super('INTELLIGENCE_FABRIC_UNAVAILABLE');
    this.name = 'IntelligenceFabricUnavailableError';
  }
}
