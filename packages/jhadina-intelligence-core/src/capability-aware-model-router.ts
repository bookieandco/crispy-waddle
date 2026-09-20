import type { ModelProvider } from './router.js';
import type { CompiledIntelligenceContext, IntelligenceRoute, IntelligenceRouteSelector, IntelligenceTask } from './intelligence-fabric.js';
import type { ModelRegistry, ModelRegistryEntry } from './model-registry.js';
import type { ClassifiedIntelligenceTask, IntelligenceComplexity } from './task-classifier.js';

export interface RegisteredModelProvider {
  readonly modelId: string;
  readonly provider: ModelProvider;
}

export interface CapabilityAwareRouterOptions {
  readonly registry: ModelRegistry;
  readonly providers: readonly RegisteredModelProvider[];
  readonly minimumContextWindowTokens?: (context: CompiledIntelligenceContext) => number;
}

const COST = { free: 0, low: 1, medium: 2, high: 3 } as const;
const LATENCY = { fast: 0, standard: 1, slow: 2 } as const;
const COMPLEXITY: Record<IntelligenceComplexity, number> = { simple: 0, moderate: 1, complex: 2, deep: 3 };

export class CapabilityAwareModelRouter implements IntelligenceRouteSelector {
  private readonly providers: ReadonlyMap<string, ModelProvider>;

  constructor(private readonly options: CapabilityAwareRouterOptions) {
    const map = new Map<string, ModelProvider>();
    for (const binding of options.providers) {
      if (map.has(binding.modelId)) throw new Error(`MODEL_ROUTER_DUPLICATE_BINDING:${binding.modelId}`);
      options.registry.require(binding.modelId);
      map.set(binding.modelId, binding.provider);
    }
    this.providers = map;
  }

  async select(task: IntelligenceTask, context: CompiledIntelligenceContext): Promise<IntelligenceRoute> {
    const minimumContextWindowTokens = this.options.minimumContextWindowTokens?.(context) ?? 0;
    const eligible = this.options.registry.eligible({
      modalities: task.modalities,
      capabilities: task.requiredCapabilities,
      privacyClass: task.privacyClass,
      minimumContextWindowTokens,
    }).filter((model) => this.providers.has(model.id));

    if (eligible.length === 0) throw new NoEligibleModelError(task.id);

    const complexity = isClassified(task) ? task.complexity : 'moderate';
    const ranked = [...eligible].sort((a, b) =>
      scoreModel(b, complexity) - scoreModel(a, complexity) || a.id.localeCompare(b.id),
    );
    const [primary, ...fallbacks] = ranked;
    return {
      provider: this.requireProvider(primary.id),
      fallbackProviders: fallbacks.map((model) => this.requireProvider(model.id)),
      reason: routeReason(primary, task, complexity, minimumContextWindowTokens),
    };
  }

  private requireProvider(modelId: string): ModelProvider {
    const provider = this.providers.get(modelId);
    if (!provider) throw new Error(`MODEL_ROUTER_PROVIDER_NOT_BOUND:${modelId}`);
    return provider;
  }
}

export class NoEligibleModelError extends Error {
  constructor(public readonly taskId: string) {
    super(`NO_ELIGIBLE_MODEL:${taskId}`);
    this.name = 'NoEligibleModelError';
  }
}

function isClassified(task: IntelligenceTask): task is ClassifiedIntelligenceTask {
  return 'complexity' in task;
}

function scoreModel(model: ModelRegistryEntry, complexity: IntelligenceComplexity): number {
  let score = 100;
  score -= COST[model.costClass] * (complexity === 'simple' ? 12 : complexity === 'moderate' ? 7 : 3);
  score -= LATENCY[model.latencyClass] * (complexity === 'simple' ? 10 : 5);
  if (model.local) score += 4;
  score += Math.min(model.contextWindowTokens / 50_000, 8);
  score += COMPLEXITY[complexity] * Math.min(model.maxOutputTokens / 4_096, 4);
  return score;
}

function routeReason(
  model: ModelRegistryEntry,
  task: IntelligenceTask,
  complexity: IntelligenceComplexity,
  minimumContextWindowTokens: number,
): string {
  return [
    `model=${model.id}`,
    `complexity=${complexity}`,
    `privacy=${task.privacyClass}`,
    `modalities=${task.modalities.join(',')}`,
    `capabilities=${task.requiredCapabilities.join(',')}`,
    `minContext=${minimumContextWindowTokens}`,
  ].join(';');
}
