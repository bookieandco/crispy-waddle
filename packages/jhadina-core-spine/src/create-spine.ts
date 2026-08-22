import { JhadinaSpine, type SpinePorts } from './spine.js';

/**
 * Composition boundary for the Jhadina control plane.
 *
 * All runtime dependencies are injected here rather than constructed by the
 * spine. This keeps model providers, memory storage, policy, execution, and
 * audit implementations outside the orchestration package and prevents a
 * second governance path from being introduced accidentally.
 */
export function createJhadinaSpine(ports: SpinePorts): JhadinaSpine {
  const required: Array<keyof SpinePorts> = [
    'memory',
    'pattern',
    'personality',
    'context',
    'decision',
    'policy',
    'action',
    'audit',
    'evolution',
  ];

  for (const name of required) {
    if (!ports[name]) {
      throw new Error(`JhadinaSpine composition is incomplete: missing ${name} port`);
    }
  }

  return new JhadinaSpine(ports);
}
