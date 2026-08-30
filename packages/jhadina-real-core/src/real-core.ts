import {
  DEFAULT_REAL_STATE,
  type AttentionPriority,
  type Evidence,
  type Opinion,
  type Preference,
  type RealState,
} from './real-state.js';

export interface RealExperience {
  id: string;
  occurredAt: string;
  source: string;
  content: string;
  significance?: 'low' | 'medium' | 'high';
  evidence?: Evidence[];
  context?: string[];
}

export interface RealCoreEvent {
  type:
    | 'EXPERIENCE_OBSERVED'
    | 'PATTERN_REINFORCED'
    | 'OPINION_FORMED'
    | 'PREFERENCE_UPDATED'
    | 'OPEN_LOOP_CREATED'
    | 'COMMITMENT_RECORDED'
    | 'ATTENTION_SHIFTED';
  at: string;
  payload: Record<string, unknown>;
}

export interface RealCoreResult {
  state: RealState;
  events: RealCoreEvent[];
  shouldSpeak: boolean;
  stance: 'support' | 'challenge' | 'clarify' | 'decline' | 'observe';
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function priorityForSignificance(significance: RealExperience['significance']): AttentionPriority {
  if (significance === 'high') return 'P1';
  if (significance === 'medium') return 'P2';
  return 'P3';
}

function unique(values: string[]): string[] {
  return [...new Set(values)].slice(-32);
}

function upsertPreference(preferences: Preference[], statement: string, evidence: Evidence[], now: string): Preference[] {
  const normalized = statement.trim().toLowerCase();
  const existing = preferences.find((p) => p.statement.trim().toLowerCase() === normalized);
  if (!existing) {
    return [...preferences, {
      id: `pref_${Date.now()}`,
      statement,
      confidence: 0.65,
      stability: 0.45,
      evidence,
      status: 'candidate',
    }];
  }
  return preferences.map((p) => p.id === existing.id
    ? { ...p, confidence: clamp(p.confidence + 0.08), stability: clamp(p.stability + 0.04), evidence: [...p.evidence, ...evidence].slice(-12), status: 'accepted' }
    : p);
}

/**
 * Real Core is the durable behavioral layer between raw model output and the
 * rest of Jhadina. It does not pretend to have human feelings. It gives Jhadina
 * continuity: experiences can change attention, opinions, preferences, loops,
 * and confidence, and those changes survive model/provider replacement.
 */
export class RealCore {
  private state: RealState;

  constructor(initial: Partial<RealState> = {}) {
    this.state = {
      ...DEFAULT_REAL_STATE,
      ...initial,
      identity: { ...DEFAULT_REAL_STATE.identity, ...(initial.identity ?? {}) },
      attention: { ...DEFAULT_REAL_STATE.attention, ...(initial.attention ?? {}) },
      tone: { ...DEFAULT_REAL_STATE.tone, ...(initial.tone ?? {}) },
    };
  }

  snapshot(): RealState {
    return structuredClone(this.state);
  }

  observe(experience: RealExperience): RealCoreResult {
    const now = experience.occurredAt;
    const evidence = experience.evidence ?? [{ id: experience.id, source: experience.source, observedAt: now, summary: experience.content.slice(0, 240) }];
    const events: RealCoreEvent[] = [{ type: 'EXPERIENCE_OBSERVED', at: now, payload: { experienceId: experience.id } }];
    const priority = priorityForSignificance(experience.significance);

    this.state = {
      ...this.state,
      currentContext: unique([...this.state.currentContext, ...(experience.context ?? [])]),
      recentExperiences: unique([...this.state.recentExperiences, experience.id]),
      confidence: clamp(this.state.confidence + (experience.significance === 'high' ? 0.03 : 0)),
      updatedAt: now,
    };

    if (experience.significance !== 'low') {
      const attentionChanged = this.state.attention.subject !== experience.source || priority < this.state.attention.priority;
      if (attentionChanged) {
        this.state.attention = { subject: experience.source, priority, reason: experience.content.slice(0, 180), since: now };
        events.push({ type: 'ATTENTION_SHIFTED', at: now, payload: { subject: experience.source, priority } });
      }
    }

    const patternKey = `Observed: ${experience.content.trim().slice(0, 120)}`;
    if (!this.state.learnedPatterns.includes(patternKey)) {
      this.state.learnedPatterns = unique([...this.state.learnedPatterns, patternKey]);
      events.push({ type: 'PATTERN_REINFORCED', at: now, payload: { pattern: patternKey } });
    }

    const stance = this.deriveStance(experience.content);
    const shouldSpeak = stance !== 'observe';
    return { state: this.snapshot(), events, shouldSpeak, stance };
  }

  formOpinion(input: { statement: string; evidence: Evidence[]; confidence?: number; at: string }): RealCoreEvent {
    const existing = this.state.opinions.find((o) => o.statement.toLowerCase() === input.statement.toLowerCase());
    const opinion: Opinion = existing
      ? { ...existing, confidence: clamp(Math.max(existing.confidence, input.confidence ?? existing.confidence)), evidence: [...existing.evidence, ...input.evidence].slice(-16), lastReviewedAt: input.at, status: 'active' }
      : { id: `op_${Date.now()}`, statement: input.statement, confidence: clamp(input.confidence ?? 0.6), evidence: input.evidence, formedAt: input.at, lastReviewedAt: input.at, status: 'active' };
    this.state.opinions = existing ? this.state.opinions.map((o) => o.id === existing.id ? opinion : o) : [...this.state.opinions, opinion];
    this.state.updatedAt = input.at;
    return { type: 'OPINION_FORMED', at: input.at, payload: { opinionId: opinion.id, statement: opinion.statement } };
  }

  learnPreference(statement: string, evidence: Evidence[], at: string): RealCoreEvent {
    this.state.preferences = upsertPreference(this.state.preferences, statement, evidence, at);
    this.state.updatedAt = at;
    return { type: 'PREFERENCE_UPDATED', at, payload: { statement } };
  }

  openLoop(description: string, priority: AttentionPriority, at: string): RealCoreEvent {
    const id = `loop_${Date.now()}`;
    this.state.openLoops = [...this.state.openLoops, { id, description, priority, lastTouchedAt: at, status: 'open' }].slice(-64);
    this.state.updatedAt = at;
    return { type: 'OPEN_LOOP_CREATED', at, payload: { id, description, priority } };
  }

  private deriveStance(content: string): RealCoreResult['stance'] {
    const text = content.toLowerCase();
    if (/(danger|unsafe|fraud|illegal|breach|attack)/.test(text)) return 'decline';
    if (/(why|should i|what do you think|recommend)/.test(text)) return 'challenge';
    if (/(unclear|confused|which one|not sure)/.test(text)) return 'clarify';
    if (/(please|can you|help|build|do this)/.test(text)) return 'support';
    return 'observe';
  }
}
