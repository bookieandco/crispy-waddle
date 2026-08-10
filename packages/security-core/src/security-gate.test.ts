import { runSecurityGate } from './security-gate.js';

const results = runSecurityGate();

for (const result of results) {
  if (!result.passed) {
    throw new Error(`SECURITY_GATE_FAILED:${result.id}:${result.actual}:${result.expected}`);
  }
}

if (results.length < 5) {
  throw new Error('SECURITY_GATE_INCOMPLETE');
}

console.log(`Security Gate passed: ${results.length} cases`);
