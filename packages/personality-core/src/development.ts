import {
  DEFAULT_PERSONALITY_POLICY,
  PersonalityObservation,
  PersonalityState,
  PersonalityTrait,
  PersonalityDevelopmentPolicy,
  observePersonality,
  registerContradiction,
} from "./index";

export interface PersonalityReflection {
  dominantTraits: PersonalityTrait[];
  emergingTraits: PersonalityTrait[];
  contradictions: PersonalityTrait[];
  uncertainties: PersonalityTrait[];
}

export interface PersonalityDecision {
  kind: "AGREE" | "DISAGREE" | "UNCERTAIN";
  reason: string;
  traitId?: string;
}

export class PersonalityDevelopmentEngine {
  constructor(
    private state: PersonalityState,
    private readonly policy: PersonalityDevelopmentPolicy = DEFAULT_PERSONALITY_POLICY,
  ) {}

  observe(observation: PersonalityObservation): PersonalityState {
    this.state = observePersonality(this.state, observation, this.policy);
    return this.state;
  }

  revise(traitId: string, revisedStatement: string): PersonalityState {
    this.state = registerContradiction(this.state, traitId, revisedStatement);
    return this.state;
  }

  reflect(): PersonalityReflection {
    return {
      dominantTraits: this.state.traits.filter(
        (trait) => trait.state === "ESTABLISHED" && trait.confidence >= this.policy.establishmentThreshold,
      ),
      emergingTraits: this.state.traits.filter(
        (trait) => trait.state === "OBSERVED" || trait.state === "REPEATED" || trait.state === "EMERGING",
      ),
      contradictions: this.state.traits.filter((trait) => trait.contradictionCount > 0),
      uncertainties: this.state.traits.filter((trait) => trait.confidence < 0.6),
    };
  }

  decideAgainstUser(
    category: PersonalityTrait["category"],
    userClaim: string,
    evidenceConfidence: number,
  ): PersonalityDecision {
    const trait = this.state.traits.find(
      (candidate) => candidate.category === category && candidate.state === "ESTABLISHED",
    );

    if (!trait) {
      return {
        kind: "UNCERTAIN",
        reason: "Jhadina has not developed enough independent evidence to take a position yet.",
      };
    }

    if (evidenceConfidence >= trait.confidence) {
      return {
        kind: "UNCERTAIN",
        reason: `The new evidence is at least as strong as Jhadina's existing evidence about: ${trait.statement}`,
        traitId: trait.id,
      };
    }

    if (trait.statement.toLowerCase() !== userClaim.toLowerCase()) {
      return {
        kind: "DISAGREE",
        reason: `Jhadina's established view differs from the user's claim: ${trait.statement}`,
        traitId: trait.id,
      };
    }

    return {
      kind: "AGREE",
      reason: "The user's claim is consistent with Jhadina's established view.",
      traitId: trait.id,
    };
  }

  snapshot(): PersonalityState {
    return structuredClone(this.state);
  }
}
