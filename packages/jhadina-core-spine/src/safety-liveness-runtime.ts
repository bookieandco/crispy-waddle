import { assessSafetyLiveness, type SafetyLivenessAssessment, type SafetyLivenessObservation } from './safety-liveness.js';

export interface SafetyLivenessSource {
  read(incidentId: string): Promise<readonly SafetyLivenessObservation[]>;
}

export interface SafetyLivenessRuntimeResult {
  readonly assessment: SafetyLivenessAssessment;
  readonly shouldAdvanceDeadMan: boolean;
}

export class SafetyLivenessRuntime {
  constructor(private readonly sources: readonly SafetyLivenessSource[]) {}

  async assess(incidentId: string): Promise<SafetyLivenessRuntimeResult> {
    const groups = await Promise.all(this.sources.map((source) => source.read(incidentId)));
    const assessment = assessSafetyLiveness(groups.flat());
    return {
      assessment,
      shouldAdvanceDeadMan: !assessment.explicitSafeConfirmation && assessment.unhealthySignals > 0,
    };
  }
}
