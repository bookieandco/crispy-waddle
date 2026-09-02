export type SecurityPosture = 'normal' | 'elevated' | 'restricted' | 'lockdown';

export type SecuritySignal =
  | 'suspicious_authentication'
  | 'replay_attempt'
  | 'credential_exposure'
  | 'worker_compromise'
  | 'critical_vulnerability'
  | 'integrity_failure'
  | 'audit_failure'
  | 'confirmed_compromise'
  | 'recovery_verified';

const rank: Record<SecurityPosture, number> = {
  normal: 0,
  elevated: 1,
  restricted: 2,
  lockdown: 3,
};

/**
 * Monotonic fail-closed posture transitions. Recovery is the only transition
 * that can lower posture, and it requires an explicit verified recovery signal.
 */
export function transitionSecurityPosture(
  current: SecurityPosture,
  signal: SecuritySignal,
): SecurityPosture {
  if (signal === 'recovery_verified') return current === 'lockdown' ? 'restricted' : 'normal';
  if (signal === 'confirmed_compromise' || signal === 'integrity_failure') return 'lockdown';
  if (signal === 'worker_compromise' || signal === 'credential_exposure' || signal === 'audit_failure') {
    return rank[current] >= rank.restricted ? current : 'restricted';
  }
  if (signal === 'critical_vulnerability' || signal === 'replay_attempt' || signal === 'suspicious_authentication') {
    return rank[current] >= rank.elevated ? current : 'elevated';
  }
  return current;
}

export function isCapabilityPermitted(
  posture: SecurityPosture,
  capability: string,
): boolean {
  if (capability === 'security.weaken' || capability === 'policy.weaken') return false;
  if (posture === 'lockdown') {
    return capability.startsWith('read.') || capability === 'security.recover';
  }
  if (posture === 'restricted') {
    return !new Set([
      'financial.execute',
      'credential.rotate',
      'connector.create',
      'publish.public',
      'evolution.promote',
    ]).has(capability);
  }
  if (posture === 'elevated') {
    return !new Set(['financial.execute', 'credential.rotate', 'connector.create']).has(capability);
  }
  return true;
}
