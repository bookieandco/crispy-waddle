import type { SafetyChaosCase, SafetyFailure } from './safety-chaos.js';

export interface SafetyFaultInjector {
  enable(failure: SafetyFailure): Promise<void>;
  reset(): Promise<void>;
}

export interface SafetyInvariantProbe {
  verify(invariant: SafetyChaosCase['mustPreserve'][number]): Promise<boolean>;
}

export interface SafetyChaosResult {
  readonly caseId: string;
  readonly passed: boolean;
  readonly failedInvariants: readonly string[];
}

export async function runSafetyChaosCase(
  testCase: SafetyChaosCase,
  injector: SafetyFaultInjector,
  probe: SafetyInvariantProbe,
): Promise<SafetyChaosResult> {
  try {
    for (const failure of testCase.failures) await injector.enable(failure);
    const failed: string[] = [];
    for (const invariant of testCase.mustPreserve) {
      if (!await probe.verify(invariant)) failed.push(invariant);
    }
    return { caseId: testCase.id, passed: failed.length === 0, failedInvariants: failed };
  } finally {
    await injector.reset();
  }
}
