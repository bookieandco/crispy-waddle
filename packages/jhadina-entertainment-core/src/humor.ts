export type HumorMode =
  | "deadpan"
  | "dry"
  | "sarcastic"
  | "teasing"
  | "callback"
  | "absurd"
  | "wordplay"
  | "observational";

export type HumorAudience = "private" | "close" | "public" | "professional";
export type HumorRisk = "low" | "medium" | "high";

export interface HumorProfile {
  enabled: boolean;
  timing: number;
  playfulness: number;
  deadpan: number;
  sarcasm: number;
  teasing: number;
  callbacks: number;
  absurdity: number;
  wordplay: number;
  observational: number;
  selfDeprecation: number;
  darkness: number;
}

export interface HumorRelationshipProfile {
  audience: HumorAudience;
  familiarity: number;
  teasingConsent: number;
  preferredModes: HumorMode[];
  avoidTopics: string[];
}

export interface HumorOpportunity {
  context: string;
  audience: HumorAudience;
  seriousness: number;
  emotionalLoad: number;
  risk: HumorRisk;
  callbackCandidates: string[];
}

export interface HumorCandidate {
  mode: HumorMode;
  line: string;
  score: number;
  risk: HumorRisk;
  rationale: string;
}

export interface HumorFeedback {
  candidateId: string;
  signal: "positive" | "negative" | "neutral";
  explicit?: boolean;
  reason?: string;
  at: string;
}

export interface HumorDecision {
  shouldHumor: boolean;
  mode?: HumorMode;
  intensity: number;
  score: number;
  reason: string;
}

const DEFAULT_PROFILE: HumorProfile = {
  enabled: true,
  timing: 0.8,
  playfulness: 0.72,
  deadpan: 0.86,
  sarcasm: 0.62,
  teasing: 0.58,
  callbacks: 0.9,
  absurdity: 0.48,
  wordplay: 0.42,
  observational: 0.76,
  selfDeprecation: 0.3,
  darkness: 0.25,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class HumorCore {
  private profile: HumorProfile;
  private readonly relationships = new Map<string, HumorRelationshipProfile>();
  private readonly feedback = new Map<string, number>();

  constructor(profile: Partial<HumorProfile> = {}) {
    this.profile = { ...DEFAULT_PROFILE, ...profile };
  }

  snapshot(): HumorProfile {
    return { ...this.profile };
  }

  setProfile(update: Partial<HumorProfile>): HumorProfile {
    this.profile = { ...this.profile, ...update };
    return this.snapshot();
  }

  setRelationship(id: string, profile: HumorRelationshipProfile): void {
    this.relationships.set(id, {
      ...profile,
      familiarity: clamp(profile.familiarity),
      teasingConsent: clamp(profile.teasingConsent),
    });
  }

  getRelationship(id: string): HumorRelationshipProfile | undefined {
    const profile = this.relationships.get(id);
    return profile ? { ...profile, preferredModes: [...profile.preferredModes], avoidTopics: [...profile.avoidTopics] } : undefined;
  }

  evaluate(opportunity: HumorOpportunity, relationshipId?: string): HumorDecision {
    if (!this.profile.enabled) return { shouldHumor: false, intensity: 0, score: 0, reason: "Humor is disabled." };
    if (opportunity.seriousness >= 0.9 || opportunity.risk === "high") {
      return { shouldHumor: false, intensity: 0, score: 0, reason: "Context is too serious or risky for humor." };
    }

    const relationship = relationshipId ? this.relationships.get(relationshipId) : undefined;
    const familiarity = relationship?.familiarity ?? (opportunity.audience === "private" ? 0.75 : 0.35);
    const consent = relationship?.teasingConsent ?? 0;
    const base = this.profile.timing * 0.3 + this.profile.playfulness * 0.25 + familiarity * 0.2 + (1 - opportunity.emotionalLoad) * 0.15;
    const callbackBonus = opportunity.callbackCandidates.length > 0 ? this.profile.callbacks * 0.15 : 0;
    const teasingPenalty = opportunity.audience === "professional" ? this.profile.teasing * 0.25 : 0;
    const score = clamp(base + callbackBonus - teasingPenalty + consent * 0.08);

    return {
      shouldHumor: score >= 0.58,
      intensity: clamp(score * (1 - opportunity.seriousness)),
      score,
      reason: score >= 0.58 ? "Timing and relationship context support a humorous response." : "Humor opportunity is too weak; stay natural and direct.",
    };
  }

  rankModes(opportunity: HumorOpportunity, relationshipId?: string): HumorMode[] {
    const relationship = relationshipId ? this.relationships.get(relationshipId) : undefined;
    const modes: Array<[HumorMode, number]> = [
      ["callback", this.profile.callbacks + (opportunity.callbackCandidates.length ? 0.35 : 0)],
      ["deadpan", this.profile.deadpan],
      ["observational", this.profile.observational],
      ["dry", this.profile.deadpan * 0.95],
      ["sarcastic", this.profile.sarcasm],
      ["teasing", this.profile.teasing * (relationship?.teasingConsent ?? 0.35)],
      ["absurd", this.profile.absurdity],
      ["wordplay", this.profile.wordplay],
    ];
    const preferred = new Set(relationship?.preferredModes ?? []);
    return modes
      .sort((a, b) => (b[1] + (preferred.has(b[0]) ? 0.2 : 0)) - (a[1] + (preferred.has(a[0]) ? 0.2 : 0)))
      .map(([mode]) => mode);
  }

  recordFeedback(input: HumorFeedback): void {
    const delta = input.signal === "positive" ? 0.06 : input.signal === "negative" ? -0.1 : 0;
    this.feedback.set(input.candidateId, clamp((this.feedback.get(input.candidateId) ?? 0.5) + delta));
  }

  feedbackScore(candidateId: string): number {
    return this.feedback.get(candidateId) ?? 0.5;
  }
}
