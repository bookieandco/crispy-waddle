import type {
  IntelligenceCapability,
  IntelligenceModality,
  IntelligencePrivacyClass,
  IntelligenceRiskClass,
  IntelligenceTask,
} from './intelligence-fabric.js';

export type IntelligenceTaskKind =
  | 'conversation'
  | 'reasoning'
  | 'coding'
  | 'research'
  | 'search'
  | 'creative'
  | 'learning'
  | 'planning'
  | 'review';

export type IntelligenceComplexity = 'simple' | 'moderate' | 'complex' | 'deep';

export interface IntelligenceTaskClassificationInput {
  readonly id: string;
  readonly purpose: string;
  readonly modalities?: readonly IntelligenceModality[];
  readonly privacyClass?: IntelligencePrivacyClass;
  readonly riskClass?: IntelligenceRiskClass;
  /** Optional trusted caller hint. It never grants authority. */
  readonly taskKindHint?: IntelligenceTaskKind;
}

export interface ClassifiedIntelligenceTask extends IntelligenceTask {
  readonly kind: IntelligenceTaskKind;
  readonly complexity: IntelligenceComplexity;
  readonly classificationReasons: readonly string[];
}

const RESEARCH = /\b(research|investigate|sources?|evidence|literature|papers?|latest|current|compare sources)\b/i;
const SEARCH = /\b(search|find|look up|lookup|locate|discover)\b/i;
const CODING = /\b(code|coding|program|debug|typescript|javascript|python|sql|api|function|class|compile|test)\b/i;
const CREATIVE = /\b(write|story|script|poem|creative|brainstorm|concept|character|scene)\b/i;
const LEARNING = /\b(explain|teach|learn|tutorial|how does|what is|understand)\b/i;
const PLANNING = /\b(plan|roadmap|strategy|steps|architecture|design|schedule)\b/i;
const REVIEW = /\b(review|audit|critique|verify|validate|check|inspect|reconcile)\b/i;
const REASONING = /\b(reason|analyze|analysis|evaluate|trade-?offs?|infer|diagnose|solve)\b/i;

export class DeterministicTaskClassifier {
  classify(input: IntelligenceTaskClassificationInput): ClassifiedIntelligenceTask {
    const purpose = input.purpose.trim();
    if (!purpose) throw new Error('INTELLIGENCE_TASK_PURPOSE_REQUIRED');

    const reasons: string[] = [];
    const kind = input.taskKindHint ?? classifyKind(purpose, reasons);
    if (input.taskKindHint) reasons.push(`trusted caller hint: ${input.taskKindHint}`);

    const modalities = unique(input.modalities?.length ? input.modalities : inferModalities(kind));
    const requiredCapabilities = capabilitiesFor(kind);
    const complexity = classifyComplexity(purpose, kind, modalities, requiredCapabilities, reasons);

    return Object.freeze({
      id: input.id,
      purpose,
      modalities,
      requiredCapabilities,
      riskClass: input.riskClass ?? 'standard',
      privacyClass: input.privacyClass ?? 'internal',
      kind,
      complexity,
      classificationReasons: Object.freeze(reasons),
    });
  }
}

function classifyKind(purpose: string, reasons: string[]): IntelligenceTaskKind {
  const ordered: Array<[RegExp, IntelligenceTaskKind]> = [
    [RESEARCH, 'research'], [SEARCH, 'search'], [CODING, 'coding'],
    [REVIEW, 'review'], [PLANNING, 'planning'], [LEARNING, 'learning'],
    [CREATIVE, 'creative'], [REASONING, 'reasoning'],
  ];
  for (const [pattern, kind] of ordered) {
    if (pattern.test(purpose)) {
      reasons.push(`deterministic intent signal: ${kind}`);
      return kind;
    }
  }
  reasons.push('no specialized intent signal; defaulted to conversation');
  return 'conversation';
}

function capabilitiesFor(kind: IntelligenceTaskKind): readonly IntelligenceCapability[] {
  switch (kind) {
    case 'research': return ['research', 'reason', 'verify', 'summarize'];
    case 'search': return ['research', 'extract', 'summarize'];
    case 'coding': return ['reason', 'plan', 'critique', 'verify'];
    case 'review': return ['critique', 'verify', 'reason'];
    case 'planning': return ['plan', 'reason', 'critique'];
    case 'learning': return ['reason', 'summarize'];
    case 'creative': return ['reason', 'plan'];
    case 'reasoning': return ['reason', 'critique'];
    case 'conversation': return ['reason'];
  }
}

function inferModalities(kind: IntelligenceTaskKind): readonly IntelligenceModality[] {
  return kind === 'coding' ? ['text', 'code'] : ['text'];
}

function classifyComplexity(
  purpose: string,
  kind: IntelligenceTaskKind,
  modalities: readonly IntelligenceModality[],
  capabilities: readonly IntelligenceCapability[],
  reasons: string[],
): IntelligenceComplexity {
  let score = 0;
  const words = purpose.split(/\s+/).filter(Boolean).length;
  if (words >= 40) score += 1;
  if (words >= 120) score += 1;
  if (modalities.length > 1) score += 1;
  if (capabilities.length >= 3) score += 1;
  if (kind === 'research' || kind === 'coding' || kind === 'review') score += 1;
  if (/\b(multi[- ]step|comprehensive|deep|architecture|adversarial|cross[- ]check|reconcile)\b/i.test(purpose)) score += 2;

  const complexity: IntelligenceComplexity =
    score >= 5 ? 'deep' : score >= 3 ? 'complex' : score >= 1 ? 'moderate' : 'simple';
  reasons.push(`deterministic complexity score ${score}: ${complexity}`);
  return complexity;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}
