import { CreativeStageGraph, type CreativeStageKind } from './creative-stage-graph.js';

export type DirectorProcessStepKind =
  | 'research' | 'concept' | 'script' | 'character' | 'asset' | 'world'
  | 'wardrobe' | 'storyboard' | 'previs' | 'performance' | 'generation'
  | 'voice' | 'motion' | 'edit' | 'audio' | 'review' | 'delivery' | 'social';

export interface DirectorProcessObservation {
  id: string;
  sourceId: string;
  sourceUrl?: string;
  order: number;
  kind: DirectorProcessStepKind;
  purpose: string;
  operation: string;
  requiredCapabilities: readonly string[];
  inputs: readonly string[];
  outputs: readonly string[];
  decisionRule?: string;
  parameterHints?: Readonly<Record<string, string | number | boolean>>;
  qcChecks: readonly string[];
  failureModes: readonly string[];
  evidenceIds: readonly string[];
}

export interface DirectorProcessRecipeStep {
  id: string;
  order: number;
  kind: DirectorProcessStepKind;
  purpose: string;
  operation: string;
  dependsOn: readonly string[];
  requiredCapabilities: readonly string[];
  inputs: readonly string[];
  outputs: readonly string[];
  decisionRule?: string;
  parameters: Readonly<Record<string, string | number | boolean>>;
  qcChecks: readonly string[];
  failureModes: readonly string[];
  evidenceIds: readonly string[];
}

export interface DirectorProcessRecipe {
  id: string;
  projectId: string;
  version: number;
  objective: string;
  sourceRefs: readonly string[];
  sourceRecipeId?: string;
  mode: 'reference' | 'improved';
  targetDurationSeconds?: number;
  steps: readonly DirectorProcessRecipeStep[];
  improvementReceipts: readonly ProcessImprovementReceipt[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_PROCESS_RECIPE';
}

export interface ProcessImprovement {
  id: string;
  stepId: string;
  reason: string;
  replacementOperation?: string;
  replacementCapabilities?: readonly string[];
  replacementQcChecks?: readonly string[];
  evidenceIds: readonly string[];
}

export interface ProcessImprovementReceipt {
  id: string;
  stepId: string;
  reason: string;
  beforeOperation: string;
  afterOperation: string;
  evidenceIds: readonly string[];
}

export interface ProcessReplicationIntent {
  sourceUrls: readonly string[];
  targetPrompt: string;
  improve: boolean;
  editableDelivery: true;
  targetDurationSeconds?: number;
  targetKind: 'ad' | 'short' | 'episode' | 'film' | 'video';
  authority: 'PLANNING_ONLY';
}

const DIRECT_REPLICATION = /\b(replicate|recreate|reverse[- ]engineer|copy)\b/i;
const USE_PROCESS = /\buse\b.{0,80}\b(process|workflow|method|tutorial|recipe|steps?|way)\b/i;
const LEARN_AND_APPLY = /\b(study|learn)\b.{0,160}\b(process|workflow|method|tutorial|recipe|steps?|way)\b.{0,160}\b(use|apply|replicate|recreate|make|build|produce)\b/i;
const PROCESS_NOUN = /\b(process|workflow|method|tutorial|recipe|steps?|way|video)\b/i;
const IMPROVE = /\b(better|improve|optimi[sz]e|upgrade|stronger|cleaner|no ai slop)\b/i;
const URL = /https?:\/\/[^\s)\]}>,]+/gi;

function parseDurationSeconds(text: string): number | undefined {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const unit = match[2].toLowerCase();
  const seconds = unit.startsWith('h') ? value * 3600 : unit.startsWith('m') ? value * 60 : value;
  return Math.min(7200, Math.max(1, seconds));
}

export function detectProcessReplicationIntent(
  text: string,
  contextualSourceRefs: readonly string[] = [],
): ProcessReplicationIntent | undefined {
  const prompt = text.trim();
  const replicationLanguage = DIRECT_REPLICATION.test(prompt) || USE_PROCESS.test(prompt) || LEARN_AND_APPLY.test(prompt);
  if (!prompt || !replicationLanguage || !PROCESS_NOUN.test(prompt)) return undefined;
  const sourceUrls = [...new Set(prompt.match(URL) ?? [])];
  if (!sourceUrls.length && !contextualSourceRefs.length && !/\b(this|that|attached|uploaded|reference)\b/i.test(prompt)) return undefined;
  const targetDurationSeconds = parseDurationSeconds(prompt);
  const targetKind: ProcessReplicationIntent['targetKind'] =
    /\bad\b|commercial/i.test(prompt) && (targetDurationSeconds ?? 0) <= 120 ? 'ad'
    : /\bshort\b|reel|tiktok/i.test(prompt) ? 'short'
    : /\bepisode\b/i.test(prompt) ? 'episode'
    : /\bfilm\b|movie|feature/i.test(prompt) || (targetDurationSeconds ?? 0) > 1800 ? 'film'
    : 'video';
  return Object.freeze({
    sourceUrls: Object.freeze(sourceUrls),
    targetPrompt: prompt,
    improve: IMPROVE.test(prompt) || /\bdo it better\b/i.test(prompt),
    editableDelivery: true,
    ...(targetDurationSeconds !== undefined ? { targetDurationSeconds } : {}),
    targetKind,
    authority: 'PLANNING_ONLY',
  });
}

export function compileProcessRecipe(input: {
  id: string;
  projectId: string;
  objective: string;
  sourceRefs: readonly string[];
  observations: readonly DirectorProcessObservation[];
  targetDurationSeconds?: number;
  evidenceIds?: readonly string[];
}): DirectorProcessRecipe {
  if (!input.id.trim() || !input.projectId.trim() || !input.objective.trim()) throw new Error('DIRECTOR_PROCESS_RECIPE_IDENTITY_REQUIRED');
  if (!input.sourceRefs.length) throw new Error('DIRECTOR_PROCESS_RECIPE_SOURCE_REQUIRED');
  if (!input.observations.length) throw new Error('DIRECTOR_PROCESS_RECIPE_OBSERVATIONS_REQUIRED');
  const ordered = [...input.observations].sort((a,b)=>a.order-b.order);
  const ids = new Set<string>();
  const steps = ordered.map((observation,index)=>{
    if (!observation.id.trim() || ids.has(observation.id)) throw new Error('DIRECTOR_PROCESS_OBSERVATION_ID_INVALID');
    ids.add(observation.id);
    if (!Number.isInteger(observation.order) || observation.order < 0) throw new Error('DIRECTOR_PROCESS_OBSERVATION_ORDER_INVALID');
    if (!observation.purpose.trim() || !observation.operation.trim()) throw new Error('DIRECTOR_PROCESS_OBSERVATION_CONTENT_REQUIRED');
    if (!observation.evidenceIds.length) throw new Error('DIRECTOR_PROCESS_OBSERVATION_EVIDENCE_REQUIRED');
    return Object.freeze({
      id: observation.id,
      order: index,
      kind: observation.kind,
      purpose: observation.purpose.trim(),
      operation: observation.operation.trim(),
      dependsOn: Object.freeze(index ? [ordered[index-1]!.id] : []),
      requiredCapabilities: Object.freeze([...new Set(observation.requiredCapabilities)]),
      inputs: Object.freeze([...observation.inputs]),
      outputs: Object.freeze([...observation.outputs]),
      ...(observation.decisionRule?.trim() ? { decisionRule: observation.decisionRule.trim() } : {}),
      parameters: Object.freeze({ ...(observation.parameterHints ?? {}) }),
      qcChecks: Object.freeze([...observation.qcChecks]),
      failureModes: Object.freeze([...observation.failureModes]),
      evidenceIds: Object.freeze([...observation.evidenceIds]),
    });
  });
  return Object.freeze({
    id: input.id,
    projectId: input.projectId,
    version: 1,
    objective: input.objective.trim(),
    sourceRefs: Object.freeze([...new Set(input.sourceRefs)]),
    mode: 'reference',
    ...(input.targetDurationSeconds !== undefined ? { targetDurationSeconds: input.targetDurationSeconds } : {}),
    steps: Object.freeze(steps),
    improvementReceipts: Object.freeze([]),
    evidenceIds: Object.freeze([...new Set([...(input.evidenceIds ?? []), ...ordered.flatMap(o=>o.evidenceIds)])]),
    authority: 'DIRECTOR_PROCESS_RECIPE',
  });
}

export function improveProcessRecipe(
  recipe: DirectorProcessRecipe,
  improvements: readonly ProcessImprovement[],
): DirectorProcessRecipe {
  if (recipe.mode !== 'reference' && recipe.mode !== 'improved') throw new Error('DIRECTOR_PROCESS_RECIPE_MODE_INVALID');
  const improvementsByStep = new Map(improvements.map(item=>[item.stepId,item]));
  const receipts: ProcessImprovementReceipt[] = [];
  const steps = recipe.steps.map(step=>{
    const improvement = improvementsByStep.get(step.id);
    if (!improvement) return step;
    if (!improvement.id.trim() || !improvement.reason.trim() || !improvement.evidenceIds.length) {
      throw new Error(`DIRECTOR_PROCESS_IMPROVEMENT_INVALID:${step.id}`);
    }
    const afterOperation = improvement.replacementOperation?.trim() || step.operation;
    receipts.push(Object.freeze({
      id: improvement.id,
      stepId: step.id,
      reason: improvement.reason.trim(),
      beforeOperation: step.operation,
      afterOperation,
      evidenceIds: Object.freeze([...improvement.evidenceIds]),
    }));
    return Object.freeze({
      ...step,
      operation: afterOperation,
      requiredCapabilities: Object.freeze(improvement.replacementCapabilities ? [...new Set(improvement.replacementCapabilities)] : [...step.requiredCapabilities]),
      qcChecks: Object.freeze(improvement.replacementQcChecks ? [...new Set(improvement.replacementQcChecks)] : [...step.qcChecks]),
      evidenceIds: Object.freeze([...new Set([...step.evidenceIds, ...improvement.evidenceIds])]),
    });
  });
  const unknown = improvements.filter(item=>!recipe.steps.some(step=>step.id===item.stepId));
  if (unknown.length) throw new Error(`DIRECTOR_PROCESS_IMPROVEMENT_STEP_UNKNOWN:${unknown[0]!.stepId}`);
  return Object.freeze({
    ...recipe,
    id: `${recipe.id}:improved:v${recipe.version+1}`,
    version: recipe.version + 1,
    sourceRecipeId: recipe.id,
    mode: 'improved',
    steps: Object.freeze(steps),
    improvementReceipts: Object.freeze([...recipe.improvementReceipts, ...receipts]),
    evidenceIds: Object.freeze([...new Set([...recipe.evidenceIds, ...improvements.flatMap(item=>item.evidenceIds)])]),
  });
}

function stageKind(kind: DirectorProcessStepKind): CreativeStageKind {
  if (kind === 'research' || kind === 'concept') return 'vision';
  if (kind === 'script' || kind === 'character' || kind === 'asset' || kind === 'world' || kind === 'wardrobe') return 'treatment';
  if (kind === 'storyboard') return 'storyboard';
  if (kind === 'previs') return 'previs';
  if (kind === 'performance') return 'rehearsal';
  if (kind === 'generation' || kind === 'voice' || kind === 'motion') return 'generation';
  if (kind === 'edit' || kind === 'audio') return 'edit';
  if (kind === 'review') return 'review';
  return 'final';
}

export function compileRecipeToCreativeStageGraph(recipe: DirectorProcessRecipe): CreativeStageGraph {
  if (!recipe.steps.length) throw new Error('DIRECTOR_PROCESS_RECIPE_STEPS_REQUIRED');
  const graph = new CreativeStageGraph();
  const seen = new Set<string>();
  for (const step of [...recipe.steps].sort((a,b)=>a.order-b.order)) {
    for (const dependency of step.dependsOn) {
      if (!seen.has(dependency)) throw new Error(`DIRECTOR_PROCESS_STAGE_DEPENDENCY_NOT_READY:${step.id}:${dependency}`);
    }
    graph.add({
      id: `process:${recipe.id}:${step.id}`,
      projectId: recipe.projectId,
      kind: stageKind(step.kind),
      dependsOn: step.dependsOn.map(id=>`process:${recipe.id}:${id}`),
      status: step.dependsOn.length ? 'planned' : 'ready',
      inputArtifactIds: [...step.inputs],
      outputArtifactIds: [...step.outputs],
      version: recipe.version,
    });
    seen.add(step.id);
  }
  return graph;
}
