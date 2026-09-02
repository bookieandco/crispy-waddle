import { describe, expect, it } from 'vitest';
import { isCapabilityPermitted, transitionSecurityPosture } from './security-posture.js';

describe('security posture', () => {
  it('escalates on confirmed compromise', () => {
    expect(transitionSecurityPosture('normal', 'confirmed_compromise')).toBe('lockdown');
  });

  it('does not weaken security automatically', () => {
    expect(transitionSecurityPosture('restricted', 'suspicious_authentication')).toBe('restricted');
    expect(transitionSecurityPosture('lockdown', 'critical_vulnerability')).toBe('lockdown');
  });

  it('keeps security weakening capabilities permanently denied', () => {
    expect(isCapabilityPermitted('normal', 'security.weaken')).toBe(false);
    expect(isCapabilityPermitted('normal', 'policy.weaken')).toBe(false);
  });

  it('blocks high-impact operations under restricted posture', () => {
    expect(isCapabilityPermitted('restricted', 'financial.execute')).toBe(false);
    expect(isCapabilityPermitted('restricted', 'credential.rotate')).toBe(false);
    expect(isCapabilityPermitted('restricted', 'publish.public')).toBe(false);
  });
});
