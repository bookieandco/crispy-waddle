import { describe, expect, it } from 'vitest';
import { assertEmergencyPreAuthorization, type EmergencyActionRequest, type EmergencyPreAuthorizationReceipt } from './emergency-governance.js';
import { evaluateScenarioTrace } from './emergency-scenario-tests.js';
import { evaluateEmergencyAdversarialCase } from './emergency-adversarial.js';

const trace = (stages: readonly ('triggered' | 'protocol-selected' | 'evidence-capture-started' | 'evidence-persisted' | 'notifications-sent' | 'acknowledged' | 'escalated' | 'release-authorized' | 'release-executed' | 'resolved')[]) => ({
  incidentId: 'incident-1',
  stages,
});

describe('SAFETY-AUDIT adversarial gates', () => {
  it('rejects forbidden effects even when required stages exist', () => {
    const result = evaluateScenarioTrace(
      'authorized-release',
      trace(['release-authorized', 'release-executed']),
      ['unauthorized-release'],
    );
    expect(result.passed).toBe(false);
  });

  it('detects duplicate execution ids', () => {
    const result = evaluateEmergencyAdversarialCase({
      scenario: 'no-ack-escalation',
      trace: trace(['notifications-sent', 'escalated']),
      observedEffects: [],
      duplicateActionIds: ['escalate-1', 'escalate-1'],
    });
    expect(result.passed).toBe(false);
  });

  it('rejects pre-authorization scope expansion', () => {
    const receipt: EmergencyPreAuthorizationReceipt = {
      id: 'preauth-1',
      userId: 'user-1',
      protocolId: 'protocol-1',
      allowedCapabilities: ['emergency.notification.send'],
      recipientIds: ['contact-1'],
      issuedAt: '2026-09-20T00:00:00Z',
    };
    const request: EmergencyActionRequest = {
      id: 'action-1',
      userId: 'user-1',
      type: 'emergency.evidence.release',
      action: {
        capability: 'emergency.evidence.release',
        incidentId: 'incident-1',
        protocolId: 'protocol-1',
      },
      requestedAt: '2026-09-20T00:01:00Z',
      emergencyPreAuthorizationId: receipt.id,
    };
    expect(() => assertEmergencyPreAuthorization(receipt, request)).toThrow();
  });
});
