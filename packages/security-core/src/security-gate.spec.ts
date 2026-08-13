import { runSecurityGate } from './security-gate.js';

export function assertSecurityGatePasses(): void {
  const results = runSecurityGate();
  const failures = results.filter((result) => !result.passed);
  if (failures.length > 0) {
    throw new Error(`SECURITY_GATE_FAILED:${failures.map((failure) => `${failure.id}:${failure.actual}/${failure.expected}`).join(',')}`);
  }
}

assertSecurityGatePasses();
