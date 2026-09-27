import type { Observation } from './observation-bus.js';
import type {
  DirectorProcessObservation,
  DirectorProcessRecipe,
  DirectorProcessStepKind,
  ProcessImprovement,
} from './process-replication.js';

const KINDS = new Set<DirectorProcessStepKind>([
  'research','concept','script','character','asset','world','wardrobe','storyboard','previs',
  'performance','generation','voice','motion','edit','audio','review','delivery','social',
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim())
    : [];
}

export function extractDirectorProcessObservation(
  observation: Observation,
  fallbackOrder = 0,
): DirectorProcessObservation | undefined {
  const payload = record(observation.payload);
  const step = record(payload?.processStep);
  if (!step) return undefined;
  const kind = typeof step.kind === 'string' && KINDS.has(step.kind as DirectorProcessStepKind)
    ? step.kind as DirectorProcessStepKind
    : undefined;
  const purpose = typeof step.purpose === 'string' ? step.purpose.trim() : '';
  const operation = typeof step.operation === 'string' ? step.operation.trim() : '';
  if (!kind || !purpose || !operation) return undefined;

  const orderValue = typeof step.order === 'number' && Number.isFinite(step.order)
    ? Math.max(0, Math.floor(step.order))
    : fallbackOrder;
  const parameters = record(step.parameterHints);
  const parameterHints: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(parameters ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parameterHints[key] = value;
    }
  }

  return Object.freeze({
    id: observation.id,
    sourceId: observation.assetId,
    sourceUrl: typeof observation.provenance.sourceUrl === 'string' ? observation.provenance.sourceUrl : undefined,
    order: orderValue,
    kind,
    purpose,
    operation,
    requiredCapabilities: Object.freeze(strings(step.requiredCapabilities)),
    inputs: Object.freeze(strings(step.inputs)),
    outputs: Object.freeze(strings(step.outputs)),
    ...(typeof step.decisionRule === 'string' && step.decisionRule.trim()
      ? { decisionRule: step.decisionRule.trim() }
      : {}),
    parameterHints: Object.freeze(parameterHints),
    qcChecks: Object.freeze(strings(step.qcChecks)),
    failureModes: Object.freeze(strings(step.failureModes)),
    evidenceIds: Object.freeze([observation.id]),
  });
}

const has = (values: readonly string[], pattern: RegExp) => values.some(value => pattern.test(value));

export function deriveDirectorNativeImprovements(
  recipe: DirectorProcessRecipe,
): readonly ProcessImprovement[] {
  const improvements: ProcessImprovement[] = [];

  for (const step of recipe.steps) {
    const text = [step.operation, step.purpose, ...step.failureModes, ...step.qcChecks].join(' ').toLowerCase();
    const capabilities = new Set(step.requiredCapabilities);
    const qc = new Set(step.qcChecks);
    const reasons: string[] = [];
    let operation = step.operation;

    const identityRisk =
      /reroll|face drift|identity drift|character drift|same face/.test(text) ||
      (step.kind === 'character' && has(step.failureModes, /drift|identity|face/i));
    if (identityRisk) {
      capabilities.add('canonical-identity-reference');
      capabilities.add('certified-visual-adapter');
      qc.add('identity-lock');
      qc.add('held-out-checkpoint-certification');
      reasons.push('Director can replace prompt/reroll identity matching with canonical references, adapter certification, and held-out identity QC.');
      operation = 'Bind canonical character references and a certified visual identity adapter; generate controlled takes and admit only identity-locked output.';
    }

    const garmentRisk =
      /garment|wardrobe|shirt|hoodie|logo|print drift|product drift/.test(text) ||
      step.kind === 'wardrobe';
    if (garmentRisk) {
      capabilities.add('production-asset-package');
      capabilities.add('wardrobe-state');
      qc.add('garment-lock');
      qc.add('product-fidelity');
      reasons.push('Director can bind clothing/products to versioned asset packages and reject logo, color, silhouette, or temporal garment drift.');
      operation = step.kind === 'wardrobe'
        ? 'Resolve wardrobe from versioned production assets and World State, then enforce Garment Lock and product-fidelity QC.'
        : operation;
    }

    const spatialRisk =
      /collision|geometry|spatial|floating|intersect|reach|position|location drift|object drift/.test(text) ||
      step.kind === 'world';
    if (spatialRisk) {
      capabilities.add('world-state-graph');
      capabilities.add('spatial-preflight');
      qc.add('spatial-continuity');
      reasons.push('Director can validate object/location state and affordances before expensive generation.');
      if (step.kind === 'world') {
        operation = 'Bind the scene to World State and versioned spatial assets; run affordance/co-location preflight before rendering.';
      }
    }

    const broadRegen =
      /regenerate (the )?(whole|full|entire)|rerender (the )?(whole|full|entire)|start over/.test(text);
    if (broadRegen) {
      capabilities.add('localized-repair');
      capabilities.add('timeline-versioning');
      qc.add('targeted-rerun');
      reasons.push('Director can localize the failing range and invalidate only affected descendants instead of rebuilding approved material.');
      operation = 'Diagnose the failing range, preserve approved locks, regenerate only invalidated descendants, and compare the repair against the prior timeline version.';
    }

    if (step.kind === 'performance' || /blocking|eyeline|rehears|table read|performance pass|interaction/.test(text)) {
      capabilities.add('director-rehearsal-loop');
      capabilities.add('low-cost-previs');
      qc.add('rehearsal-graduation');
      qc.add('performance-notes-resolved');
      reasons.push('Director can rehearse dialogue, blocking, eyelines, gestures, interactions, and camera timing cheaply before committing to final-generation cost.');
      operation = 'Run a low-cost Director rehearsal loop: table-read/blocking/performance passes, issue evidence-backed notes, retry until graduation, then preserve the approved Performance Master for final generation.';
    }

    const weakSelection =
      /pick (the )?best|choose (the )?best|looks best|whichever looks/.test(text) ||
      (step.kind === 'review' && step.qcChecks.length === 0);
    if (weakSelection) {
      capabilities.add('multimodal-take-selection');
      capabilities.add('production-coherence-gate');
      qc.add('cross-domain-coherence');
      reasons.push('Director can replace unaudited aesthetic picking with multimodal take evidence plus the Production Coherence Gate.');
      operation = 'Score candidate takes with multimodal evidence and cross-domain coherence checks; preserve subjective close calls for human selection.';
    }

    if (!reasons.length) continue;
    improvements.push(Object.freeze({
      id: `director-native:${recipe.id}:${step.id}`,
      stepId: step.id,
      reason: reasons.join(' '),
      replacementOperation: operation,
      replacementCapabilities: Object.freeze([...capabilities]),
      replacementQcChecks: Object.freeze([...qc]),
      evidenceIds: Object.freeze([
        'director-capability:production-foundry',
        'director-capability:creative-stage-graph',
        'director-capability:timeline-versioning',
      ]),
    }));
  }

  return Object.freeze(improvements);
}
